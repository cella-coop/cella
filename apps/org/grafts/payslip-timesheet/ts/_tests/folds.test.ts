// The payslip-timesheet graft's fold (`sql/002-folds.sql`), on a database
// holding the app's core, the payslip and timesheet feats and this graft,
// in a transaction rolled back after: a run's minutes fold as the
// commitments its entry keeps, each payslip's column as erasure leaves
// it. Run by `cella test slice payslip-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a run\'s minutes fold as their commitments', async () => {
  await db.query('SELECT payslip_timesheet.fold_generate($1)', [
    { n: 7, op: 'payslip:run:generate', actor: sacha, date: '2041-02-02', cause: null, payload: { month: '2041-01', minutes: 9000, timed: [{ member: sacha, minutes: commitment }] } },
  ])
  assert.deepEqual((await db.query(`SELECT field, n FROM cella.commitment WHERE subject = $1`, [sacha])).rows, [{ field: 'payslip.payslip.minutes', n: '7' }])
})
