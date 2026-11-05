// The payslip-transaction graft's folds (`sql/003-folds.sql`), on a
// database holding the app's core, the payslip and transaction feats and
// this graft, in a transaction rolled back after: a run's approval and
// its payment each fold the entry its payload keeps, linked as the event
// it is, and refuse one that keeps none. Run by `cella test slice
// payslip-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const entry = (n: number, op: string, payload: unknown) => ({ n, op, actor: 'julien@folded.example', date: '2041-02-03', cause: null, payload })
// The next id is read under the counter's lock, so a sibling test file's
// post waits for this file's rollback rather than taking the number.
const next = async () => (await db.query<{ id: string }>(`SELECT 'je-' || lpad((last + 1)::text, 4, '0') AS id FROM transaction.journal FOR UPDATE`)).rows[0].id

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a run\'s accrual and payment fold their entries, each linked as its event', async () => {
  const accrual = await next()
  await db.query('SELECT payslip_transaction.fold_approve($1)', [
    entry(1, 'payslip:run:approve', { month: '2041-01', entry: accrual, posting: { date: '2041-01-31', label: 'Payroll, 2041-01', lines: [{ account: '641', side: 'debit', cents: 3000_00 }, { account: '421', side: 'credit', cents: 3000_00 }] } }),
  ])
  const payment = await next()
  await db.query('SELECT payslip_transaction.fold_pay($1)', [
    entry(2, 'payslip:run:pay', { month: '2041-01', entry: payment, posting: { date: '2041-02-03', label: 'Payroll paid, 2041-01', lines: [{ account: '421', side: 'debit', cents: 3000_00 }, { account: '512', side: 'credit', cents: 3000_00 }] } }),
  ])
  assert.deepEqual((await db.query(`SELECT p.event, e.label, to_char(e.date, 'YYYY-MM-DD') AS date FROM payslip_transaction.posting p JOIN transaction.entry e ON e.id = p.entry WHERE p.month = '2041-01' ORDER BY p.event`)).rows, [
    { event: 'accrual', label: 'Payroll, 2041-01', date: '2041-01-31' },
    { event: 'payment', label: 'Payroll paid, 2041-01', date: '2041-02-03' },
  ])
  await db.query('SAVEPOINT refused')
  await assert.rejects(db.query('SELECT payslip_transaction.fold_pay($1)', [entry(3, 'payslip:run:pay', { month: '2041-02', entry: 'je-9999' })]), /entry 3 keeps no posting of 2041-02's payment/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
