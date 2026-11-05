// The meeting-membership graft's folds (`sql/005-folds.sql`), on a
// database holding the app's core, the meeting and member feats and this
// graft, in a transaction rolled back after: a member's own mark and a
// mark the minutes' keeper records fold as the entry names them, on its
// day and by its actor, the last winning. Run by `cella test slice
// meeting-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const camille = 'camille@folded.example'
const meeting = 'folding-2041-03-04'

const fold = (fn: string, n: number, op: string, actor: string, date: string, payload: unknown) =>
  db.query(`SELECT meeting_membership.${fn}($1)`, [{ n, op, actor, date, cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('folding', 'Folding') ON CONFLICT DO NOTHING`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Sacha Folded') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2020-01-02', 1)`,
    [sacha],
  )
  await db.query(`INSERT INTO meeting.meeting (id, circle, title, at) VALUES ($1, 'folding', 'Folding', '2041-03-04 10:00')`, [meeting])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a mark and a record fold on their entries\' days, by their actors, the last winning', async () => {
  await fold('fold_mark', 1, 'meeting-membership:attendance:mark', sacha, '2041-03-01', { meeting, member: sacha, status: 'excused', circle: 'folding' })
  await fold('fold_record', 2, 'meeting-membership:attendance:record', camille, '2041-03-04', { meeting, member: sacha, status: 'present', circle: 'folding' })
  assert.deepEqual(
    (await db.query(`SELECT member, status, to_char(marked, 'YYYY-MM-DD') AS marked, by FROM meeting_membership.attendance WHERE meeting = $1`, [meeting])).rows,
    [{ member: sacha, status: 'present', marked: '2041-03-04', by: camille }],
  )
})
