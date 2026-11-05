// The meeting-motion graft's fold (`sql/002-folds.sql`), on a database
// holding the app's core, the meeting and motion feats and this graft, in
// a transaction rolled back after: an item added that tables a motion
// folds tabling it, and one that tables none writes nothing here. Run by
// `cella test slice meeting-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const meeting = 'folding-2041-03-04'
let tables = 0
let plain = 0

const fold = (n: number, payload: unknown) =>
  db.query('SELECT meeting_motion.fold_add($1)', [{ n, op: 'meeting:item:add', actor: 'malik@folded.example', date: '2041-03-01', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('folding', 'Folding') ON CONFLICT DO NOTHING`)
  await db.query(
    `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline)
     VALUES ('m-2041-001', 'folding', 'camille@folded.example', 'Fold the rate card', 'consent', 'consent', '2041-02-20', '2041-03-20')`,
  )
  await db.query(`INSERT INTO meeting.meeting (id, circle, title, at) VALUES ($1, 'folding', 'Folding', '2041-03-04 10:00')`, [meeting])
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO meeting.item (meeting, pos, title) VALUES ($1, 1, 'Fold the rate card'), ($1, 2, 'Other') RETURNING id::text AS id`,
    [meeting],
  )
  ;[tables, plain] = rows.map((r) => Number(r.id))
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an item that tables a motion folds tabling it; one that tables none, nothing', async () => {
  await fold(1, { meeting, item: tables, pos: '1', title: 'Fold the rate card', presenter: null, minutes: null, motion: 'm-2041-001' })
  await fold(2, { meeting, item: plain, pos: '2', title: 'Other', presenter: null, minutes: null })
  assert.deepEqual((await db.query(`SELECT item::int, meeting, motion FROM meeting_motion.tabled WHERE meeting = $1`, [meeting])).rows, [
    { item: tables, meeting, motion: 'm-2041-001' },
  ])
})
