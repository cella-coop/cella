// How a circle meets, on a database holding the app's core,
// its circles, and the meeting feat: a setting names a circle that
// exists, within its bounds, and `meeting.meets` refuses a meeting
// of no circle. Run by `cella test slice meeting`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assemblée générale', true)`)
  await db.query(
    `INSERT INTO meeting.meeting (id, circle, title, at) VALUES
       ('ag-2026-11-28', 'ag', 'General assembly', '2026-10-31 10:00'),
       ('dreams-2026-11-28', 'dreams', 'Nowhere', '2026-10-31 10:00')`,
  )
})

after(async () => {
  await db.end()
})

test('a setting names a circle that exists, and a quorum between 1 and 100 %', async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO meeting.setting (circle, quorum, adopts) VALUES ('ag', 50, true)`)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO meeting.setting (circle) VALUES ('dreams')`), /no circle dreams/)
  await db.query('ROLLBACK')
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO meeting.setting (circle, quorum) VALUES ('ag', 0)`), /setting_quorum_check/)
  await db.query('ROLLBACK')
})

test('a meeting is a circle\'s that exists', async () => {
  const meets = async (payload: object) => (await db.query<{ r: string | null }>('SELECT meeting.meets($1) AS r', [payload])).rows[0].r
  assert.equal(await meets({ meeting: 'ag-2026-11-28', circle: 'ag' }), null)
  assert.equal(await meets({ meeting: 'dreams-2026-11-28', circle: 'dreams' }), 'no circle dreams to meet')
})
