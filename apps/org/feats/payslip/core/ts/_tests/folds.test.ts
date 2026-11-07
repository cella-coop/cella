// The payslip feat's folds (`sql/005-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a run
// folds prepared with a payslip for each member its figures name, every
// figure as its commitment, then approved by the entry's actor and paid,
// on their entries' days. Run by `cella test slice payslip`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const camille = 'camille@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, actor: string, date: string, payload: unknown) =>
  db.query(`SELECT payslip.${fn}($1)`, [{ n, op, actor, date, cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a run folds prepared with its payslips as their commitments, approved and paid', async () => {
  const figures = [{ member: sacha, gross: commitment, employee: commitment, employer: commitment, net: commitment }]
  await fold('fold_generate', 1, 'payslip:run:generate', camille, '2041-02-02', { month: '2041-01', day: '2041-02-02', payslips: 1, gross: 300000, figures })
  assert.deepEqual(await one(`SELECT member, minutes, gross, employee, employer, net FROM payslip.payslip WHERE month = '2041-01'`), {
    member: sacha,
    minutes: null,
    gross: null,
    employee: null,
    employer: null,
    net: null,
  })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field LIKE 'payslip.payslip.%' AND subject = $1`, [sacha])).n, '4')
  await fold('fold_approve', 2, 'payslip:run:approve', camille, '2041-02-03', { month: '2041-01' })
  await fold('fold_pay', 3, 'payslip:run:pay', sacha, '2041-02-04', { month: '2041-01' })
  assert.deepEqual(
    await one(`SELECT to_char(generated, 'YYYY-MM-DD') AS generated, to_char(approved, 'YYYY-MM-DD') AS approved, approver, to_char(paid, 'YYYY-MM-DD') AS paid FROM payslip.run WHERE month = '2041-01'`),
    { generated: '2041-02-02', approved: '2041-02-03', approver: camille, paid: '2041-02-04' },
  )
})
