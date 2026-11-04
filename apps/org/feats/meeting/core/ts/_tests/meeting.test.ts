// The meetings alone, on a database holding only the app's core and this
// feat: an agenda changes only while its meeting is scheduled, a meeting
// held or cancelled stays so and a cancelled one has no minutes, and the
// guards check that a hold or a cancel was the write's own and that no
// meeting is held before its day. Run by `cella test slice meeting`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const refused = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql, values), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT meeting.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO meeting.meeting (id, circle, title, at, place) VALUES
       ('coordination-2026-10-19', 'coordination', 'Coordination', '2026-10-19 10:00', 'Studio'),
       ('coordination-2026-10-26', 'coordination', 'Coordination', '2026-10-26 10:00', 'Studio'),
       ('ag-2026-10-31', 'ag', 'General assembly', '2026-10-31 10:00', 'Studio')`,
  )
  await db.query(
    `INSERT INTO meeting.item (meeting, pos, title, presenter, minutes) VALUES
       ('coordination-2026-10-19', 1, 'Pipeline', 'Camille', 20),
       ('coordination-2026-10-19', 2, 'Staffing', 'Yusuf', 15)`,
  )
  await db.query(`UPDATE meeting.meeting SET status = 'held', settled = '2026-10-19' WHERE id = 'coordination-2026-10-19'`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('meeting_membership', 'document')`)
  assert.deepEqual(rows, [])
})

test('a held meeting\'s agenda is fixed: no item added, moved or removed', async () => {
  await refused(
    `INSERT INTO meeting.item (meeting, pos, title) VALUES ('coordination-2026-10-19', 3, 'More')`,
    [],
    /coordination-2026-10-19 was held on 2026-10-19: its agenda is fixed/,
  )
  await refused(`UPDATE meeting.item SET pos = 0 WHERE meeting = 'coordination-2026-10-19' AND title = 'Staffing'`, [], /its agenda is fixed/)
  await refused(`DELETE FROM meeting.item WHERE meeting = 'coordination-2026-10-19'`, [], /its agenda is fixed/)
})

test('a scheduled meeting\'s agenda moves freely', async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO meeting.item (meeting, pos, title) VALUES ('coordination-2026-10-26', 1, 'Pipeline'), ('coordination-2026-10-26', 2, 'Rate card')`)
  await db.query(`UPDATE meeting.item SET pos = 0.5 WHERE meeting = 'coordination-2026-10-26' AND title = 'Rate card'`)
  const { rows } = await db.query<{ title: string }>(`SELECT title FROM meeting.item WHERE meeting = 'coordination-2026-10-26' ORDER BY pos`)
  assert.deepEqual(rows.map((r) => r.title), ['Rate card', 'Pipeline'])
  await db.query('ROLLBACK')
})

test('a meeting held or cancelled stays so, though its minutes may still be begun', async () => {
  await refused(`UPDATE meeting.meeting SET status = 'cancelled' WHERE id = 'coordination-2026-10-19'`, [], /was held on 2026-10-19/)
  await refused(`UPDATE meeting.meeting SET at = '2026-10-20 10:00' WHERE id = 'coordination-2026-10-19'`, [], /was held on 2026-10-19/)
  await db.query('BEGIN')
  await db.query(`UPDATE meeting.meeting SET minuted = '2026-10-20' WHERE id = 'coordination-2026-10-19'`)
  await db.query('ROLLBACK')
})

test('a cancelled meeting has no minutes', async () => {
  await refused(
    `UPDATE meeting.meeting SET status = 'cancelled', settled = '2026-10-24', minuted = '2026-10-24' WHERE id = 'coordination-2026-10-26'`,
    [],
    /coordination-2026-10-26 was cancelled: it has no minutes/,
  )
})

test('a meeting is scheduled until it is settled, and settled on a day', async () => {
  await db.query('BEGIN')
  await assert.rejects(db.query(`UPDATE meeting.meeting SET status = 'held' WHERE id = 'ag-2026-10-31'`), /meeting_check/)
  await db.query('ROLLBACK')
})

test('the guards refuse a hold or a cancel the write did not make, and a hold before the meeting\'s day', async () => {
  assert.equal(await guard('holds', { meeting: 'nowhere' }), 'no meeting nowhere')
  assert.match((await guard('holds', { meeting: 'ag-2026-10-31' })) ?? '', /ag-2026-10-31 was not held by this write/)
  assert.match((await guard('cancels', { meeting: 'ag-2026-10-31' })) ?? '', /ag-2026-10-31 was not cancelled by this write/)
  for (const [day, says] of [
    ['2026-10-24', 'ag-2026-10-31 meets on 2026-10-31: it is not held before'],
    ['2026-10-31', null],
  ] as const) {
    await db.query(`SET cella.clock = '${day}'`)
    await db.query('BEGIN')
    await db.query(`UPDATE meeting.meeting SET status = 'held', settled = cella.verdict_date() WHERE id = 'ag-2026-10-31'`)
    assert.equal(await guard('holds', { meeting: 'ag-2026-10-31' }), says, day)
    await db.query('ROLLBACK')
  }
  await db.query('RESET cella.clock')
})
