// The expense-transaction graft's folds (`sql/002-folds.sql`), on a
// database holding the app's core, the expense and transaction feats and
// this graft, in a transaction rolled back after: an expense's approval
// and its reimbursement each fold the entry its payload keeps, linked as
// the event it is, and refuse one that keeps none. Run by `cella test
// slice expense-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const entry = (n: number, op: string, payload: unknown) => ({ n, op, actor: 'hugo@folded.example', date: '2041-02-03', cause: null, payload })
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

test('an expense\'s charge and payment fold their entries, each linked as its event', async () => {
  const charge = await next()
  await db.query('SELECT expense_transaction.fold_approve($1)', [
    entry(1, 'expense:expense:approve', { expense: 'ex-9901', amount: 180_00, entry: charge, posting: { date: '2041-02-03', label: 'Expense ex-9901', lines: [
      { account: '6251', side: 'debit', cents: 150_00 }, { account: '44566', side: 'debit', cents: 30_00 }, { account: '421', side: 'credit', cents: 180_00 },
    ] } }),
  ])
  const payment = await next()
  await db.query('SELECT expense_transaction.fold_reimburse($1)', [
    entry(2, 'expense:expense:reimburse', { expense: 'ex-9901', amount: 180_00, entry: payment, posting: { date: '2041-02-03', label: 'Reimbursement of ex-9901', lines: [
      { account: '421', side: 'debit', cents: 180_00 }, { account: '512', side: 'credit', cents: 180_00 },
    ] } }),
  ])
  assert.deepEqual((await db.query(`SELECT p.event, e.label, count(l.n)::int AS lines FROM expense_transaction.posting p JOIN transaction.entry e ON e.id = p.entry
    JOIN transaction.line l ON l.entry = e.id WHERE p.expense = 'ex-9901' GROUP BY p.event, e.label ORDER BY p.event`)).rows, [
    { event: 'charge', label: 'Expense ex-9901', lines: 3 },
    { event: 'payment', label: 'Reimbursement of ex-9901', lines: 2 },
  ])
  await db.query('SAVEPOINT refused')
  await assert.rejects(db.query('SELECT expense_transaction.fold_reimburse($1)', [entry(3, 'expense:expense:reimburse', { expense: 'ex-9902', entry: 'je-9999' })]),
    /entry 3 keeps no posting of ex-9902's payment/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
