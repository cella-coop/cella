// The timesheet feat's folds (`sql/007-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: an
// entry folds under its id, its note and minutes as their commitments,
// its member's month made as it was; a correction keeps its commitment;
// and a month folds submitted, then approved by the entry's actor, on
// their entries' days. Run by `cella test slice timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const camille = 'camille@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, actor: string, date: string, payload: unknown) =>
  db.query(`SELECT timesheet.${fn}($1)`, [{ n, op, actor, date, cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('time folds logged, corrected, submitted and approved', async () => {
  await fold('fold_log', 1, 'timesheet:entry:log', sacha, '2041-01-15', { entry: '9001', circle: 'ag', member: sacha, day: '2041-01-15', minutes: commitment, billable: true, note: commitment })
  assert.deepEqual(await one(`SELECT member, to_char(day, 'YYYY-MM-DD') AS day, minutes, billable, note, circle FROM timesheet.entry WHERE id = 9001`), {
    member: sacha,
    day: '2041-01-15',
    minutes: 1,
    billable: true,
    note: 'redacted',
    circle: 'ag',
  })
  await fold('fold_correct', 2, 'timesheet:entry:correct', sacha, '2041-01-16', { entry: '9001', minutes: commitment, member: sacha, day: '2041-01-15' })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field LIKE 'timesheet.entry.%' AND subject = $1`, [sacha])).n, '3')
  await fold('fold_submit', 3, 'timesheet:period:submit', sacha, '2041-02-01', { member: sacha, month: '2041-01', circle: 'ag', submitted: '2041-02-01' })
  await fold('fold_submit', 4, 'timesheet:period:submit', sacha, '2041-02-02', { member: sacha, month: '2041-01', circle: 'ag', submitted: '2041-02-01' })
  await fold('fold_approve', 5, 'timesheet:period:approve', camille, '2041-02-03', { member: sacha, month: '2041-01', circle: 'ag', approved: '2041-02-03' })
  assert.deepEqual(
    await one(`SELECT to_char(submitted, 'YYYY-MM-DD') AS submitted, to_char(approved, 'YYYY-MM-DD') AS approved, approver FROM timesheet.period WHERE member = $1 AND month = '2041-01'`, [sacha]),
    { submitted: '2041-02-01', approved: '2041-02-03', approver: camille },
  )
})
