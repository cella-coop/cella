// Motions tabled, on a database holding the app's core, the motion
// and meeting feats and this graft: an item tables a motion that
// exists, from its own meeting's agenda. Run by `cella test slice
// meeting-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
let item = 0

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

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline)
     VALUES ('m-2026-011', 'coordination', 'Raise the day rate for 2027', 'consent', 'consent', '2026-10-12', '2026-11-09')`,
  )
  await db.query(
    `INSERT INTO meeting.meeting (id, circle, title, at) VALUES
       ('coordination-2026-10-12', 'coordination', 'Coordination', '2026-10-12 10:00'),
       ('coordination-2026-10-19', 'coordination', 'Coordination', '2026-10-19 10:00')`,
  )
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO meeting.item (meeting, pos, title) VALUES ('coordination-2026-10-12', 1, 'Rate card 2027') RETURNING id::text AS id`,
  )
  item = Number(rows[0].id)
})

after(async () => {
  await db.end()
})

test('an item tables a motion that exists', async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO meeting_motion.tabled (item, meeting, motion) VALUES ($1, 'coordination-2026-10-12', 'm-2026-011')`, [item])
  await db.query('ROLLBACK')
  await refused(`INSERT INTO meeting_motion.tabled (item, meeting, motion) VALUES ($1, 'coordination-2026-10-12', 'm-2099-001')`, [item], /no motion m-2099-001/)
})

test('an item tables it from its own meeting\'s agenda', async () => {
  await refused(
    `INSERT INTO meeting_motion.tabled (item, meeting, motion) VALUES ($1, 'coordination-2026-10-19', 'm-2026-011')`,
    [item],
    new RegExp(`coordination-2026-10-19 has no item ${item}`),
  )
})
