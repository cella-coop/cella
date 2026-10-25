// Decisions tabled, on a database holding the app's core, the decision
// and meeting feats and this graft: an item tables a decision that
// exists, from its own meeting's agenda. Run by `cella test slice
// decision-meeting`.

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
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline)
     VALUES ('d-2026-011', 'coordination', 'Raise the day rate for 2027', 'consent', 'consent', '2026-10-12', '2026-11-09')`,
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

test('an item tables a decision that exists', async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO decision_meeting.tabled (item, meeting, decision) VALUES ($1, 'coordination-2026-10-12', 'd-2026-011')`, [item])
  await db.query('ROLLBACK')
  await refused(`INSERT INTO decision_meeting.tabled (item, meeting, decision) VALUES ($1, 'coordination-2026-10-12', 'd-2099-001')`, [item], /no decision d-2099-001/)
})

test('an item tables it from its own meeting\'s agenda', async () => {
  await refused(
    `INSERT INTO decision_meeting.tabled (item, meeting, decision) VALUES ($1, 'coordination-2026-10-19', 'd-2026-011')`,
    [item],
    new RegExp(`coordination-2026-10-19 has no item ${item}`),
  )
})
