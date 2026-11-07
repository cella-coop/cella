// The expense feat's folds (`sql/005-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// claim folds under the id its entry names, its label and receipt as
// their commitments, and refuses figures that do not make its total; then
// it moves along its lifecycle on its entries' days, decided by their
// actors. Run by `cella test slice expense`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sofia = 'sofia@folded.example'
const hugo = 'hugo@folded.example'
const commitment = { $commit: 'cd'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, payload: unknown, actor = sofia, date = '2041-02-03') =>
  db.query(`SELECT expense.${fn}($1)`, [{ n, op, actor, date, cause: null, payload }])
let circle = ''
const claim = () => ({ expense: 'ex-9901', circle, member: sofia, day: '2041-02-01', category: '6251', net: 150_00, vat: 30_00, amount: 180_00 })

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  circle = (await one<{ c: string }>('SELECT circle.assembly() AS c')).c
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a claim folds under its id, its label and receipt as their commitments, and refuses figures that do not make its total', async () => {
  await fold('fold_capture', 1, 'expense:expense:capture', { ...claim(), label: commitment, receipt: null })
  assert.deepEqual(await one(`SELECT id, member, label, receipt, cella.cents(net) AS net, cella.cents(vat) AS vat, status FROM expense.expense WHERE id = 'ex-9901'`), {
    id: 'ex-9901', member: sofia, label: 'redacted', receipt: null, net: '15000', vat: '3000', status: 'draft',
  })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'expense.expense.label' AND subject = $1`, [sofia])).n, '1')
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold('fold_capture', 2, 'expense:expense:capture', { ...claim(), expense: 'ex-9902', amount: 200_00, label: commitment, receipt: commitment }),
    /entry 2 claims ex-9902 for 20000 cents, but its figures come to 18000/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})

test('a claim folds submitted, approved by its actor and reimbursed on its entries\' days; another folds refused', async () => {
  await fold('fold_submit', 3, 'expense:expense:submit', { expense: 'ex-9901', circle, amount: 180_00, day: '2041-02-03' })
  await fold('fold_approve', 4, 'expense:expense:approve', { expense: 'ex-9901', circle, amount: 180_00, day: '2041-02-04' }, hugo, '2041-02-04')
  await fold('fold_reimburse', 5, 'expense:expense:reimburse', { expense: 'ex-9901', circle, amount: 180_00, day: '2041-02-05' }, hugo, '2041-02-05')
  assert.deepEqual(await one(`SELECT status, to_char(submitted, 'YYYY-MM-DD') AS submitted, to_char(decided, 'YYYY-MM-DD') AS decided, decider, to_char(reimbursed, 'YYYY-MM-DD') AS reimbursed FROM expense.expense WHERE id = 'ex-9901'`), {
    status: 'reimbursed', submitted: '2041-02-03', decided: '2041-02-04', decider: hugo, reimbursed: '2041-02-05',
  })
  await fold('fold_capture', 6, 'expense:expense:capture', { ...claim(), expense: 'ex-9903', label: commitment, receipt: commitment })
  await fold('fold_submit', 7, 'expense:expense:submit', { expense: 'ex-9903', circle, amount: 180_00, day: '2041-02-03' })
  await fold('fold_refuse', 8, 'expense:expense:refuse', { expense: 'ex-9903', circle, amount: 180_00, day: '2041-02-06' }, hugo, '2041-02-06')
  assert.deepEqual(await one(`SELECT status, receipt, to_char(decided, 'YYYY-MM-DD') AS decided, decider FROM expense.expense WHERE id = 'ex-9903'`), {
    status: 'refused', receipt: 'redacted', decided: '2041-02-06', decider: hugo,
  })
})
