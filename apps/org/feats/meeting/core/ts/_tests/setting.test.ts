// How a circle meets, on a database holding the app's core,
// its circles, and the meeting feat: a setting names a circle that
// exists, within its bounds, and a meeting of no circle is refused. Run by `cella test slice meeting`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'General assembly', true) ON CONFLICT DO NOTHING`)
})

after(async () => {
  await db.end()
})

test('a setting names a circle that exists, and a quorum between 1 and 100 %', async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO meeting.setting (circle, quorum, adopts) VALUES ('ag', 50, true)`)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO meeting.setting (circle) VALUES ('dreams')`), /setting_circle_fkey/)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO meeting.setting (circle, quorum) VALUES ('ag', 0)`), /setting_quorum_check/)
  await db.query('ROLLBACK')
})

test('a meeting is a circle\'s that exists, the root\'s where it names none', async () => {
  await db.query('BEGIN')
  const { rows } = await db.query(`INSERT INTO meeting.meeting (id, title, at) VALUES ('ag-2026-11-28', 'General assembly', '2026-10-31 10:00') RETURNING circle`)
  assert.deepEqual(rows, [{ circle: 'ag' }])
  await db.query('ROLLBACK')
  await assert.rejects(
    db.query(`INSERT INTO meeting.meeting (id, circle, title, at) VALUES ('dreams-2026-11-28', 'dreams', 'Nowhere', '2026-10-31 10:00')`),
    /meeting_circle_fkey/,
  )
})
