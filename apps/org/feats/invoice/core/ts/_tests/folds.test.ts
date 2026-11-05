// The invoice feat's folds (`sql/010-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: an
// issue spends the series' next number and refuses an entry naming
// another, its name and address billed as their commitments; a send
// keeps its first day; a payment folds under its id with its receipt,
// and a merged one adds nothing; and a void keeps its reason as its
// commitment. Run by `cella test slice invoice`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const julien = 'julien@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }
const seller = { name: 'Lanterne', form: 'SCOP SARL', capital: null, siren: '000000000', rcs: 'Bobigny', vat: 'FR00000000000', seat: 'Montreuil' }
const lines = [
  { n: 1, description: 'Posters', quantity: '2.000', unit_price: 1000_00, amount: 2000_00, vat_rate: '20.00' },
  { n: 2, description: 'Delivery', quantity: '1.000', unit_price: 50_00, amount: 50_00, vat_rate: '20.00' },
]
const issued = (invoice: string) => ({
  invoice, issued: '2041-02-03', net: 2050_00, vat: 410_00, total: 2460_00, series: 'T-2041', due: '2041-03-05',
  label: 'Posters, spring', seller, priced: lines, bill_to: commitment, bill_address: commitment,
})

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, date: string, payload: unknown) =>
  db.query(`SELECT invoice.${fn}($1)`, [{ n, op, actor: julien, date, cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO invoice.series (name, next) VALUES ('T-2041', 1)`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an issue spends the next number and folds as its entry keeps it, refusing one that names another', async () => {
  await fold('fold_issue', 1, 'invoice:invoice:issue', '2041-02-03', issued('T-2041-0001'))
  assert.deepEqual(await one(`SELECT number, to_char(issued, 'YYYY-MM-DD') AS issued, to_char(due, 'YYYY-MM-DD') AS due, bill_to, bill_address, seller, label,
                                     cella.cents(net) AS net, cella.cents(vat) AS vat, cella.cents(total) AS total FROM invoice.invoice WHERE id = 'T-2041-0001'`), {
    number: 1, issued: '2041-02-03', due: '2041-03-05', bill_to: 'redacted', bill_address: 'redacted', seller, label: 'Posters, spring',
    net: '205000', vat: '41000', total: '246000',
  })
  assert.deepEqual((await db.query(`SELECT n, description, quantity::text, cella.cents(amount) AS amount, vat_rate::text FROM invoice.line WHERE invoice = 'T-2041-0001' ORDER BY n`)).rows, [
    { n: 1, description: 'Posters', quantity: '2.000', amount: '200000', vat_rate: '20.00' },
    { n: 2, description: 'Delivery', quantity: '1.000', amount: '5000', vat_rate: '20.00' },
  ])
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field LIKE 'invoice.invoice.%' AND subject = 'T-2041-0001'`)).n, '2')
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold('fold_issue', 2, 'invoice:invoice:issue', '2041-02-03', issued('T-2041-0005')), /entry 2 issues T-2041-0005, but T-2041 spends T-2041-0002/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})

test('a send keeps its first day; a payment folds with its receipt, a merged one adds nothing', async () => {
  await fold('fold_send', 3, 'invoice:invoice:send', '2041-02-04', { invoice: 'T-2041-0001', sent: '2041-02-04' })
  await fold('fold_send', 4, 'invoice:invoice:send', '2041-02-05', { invoice: 'T-2041-0001', sent: '2041-02-04' })
  assert.deepEqual(await one(`SELECT to_char(sent, 'YYYY-MM-DD') AS sent FROM invoice.invoice WHERE id = 'T-2041-0001'`), { sent: '2041-02-04' })
  const paid = { invoice: 'T-2041-0001', payment: 990001, at: '2041-02-10', amount: 1000_00, method: 'transfer', reference: 'VIR-FOLD-1' }
  await fold('fold_payment', 5, 'invoice:invoice:payment', '2041-02-10', { ...paid, merged: false, receipt: 990007 })
  await fold('fold_payment', 6, 'invoice:invoice:payment', '2041-02-11', { ...paid, merged: true })
  assert.deepEqual((await db.query(`SELECT id, receipt, to_char(at, 'YYYY-MM-DD') AS at, cella.cents(amount) AS amount, method, reference FROM invoice.payment WHERE invoice = 'T-2041-0001'`)).rows, [
    { id: '990001', receipt: '990007', at: '2041-02-10', amount: '100000', method: 'transfer', reference: 'VIR-FOLD-1' },
  ])
})

test('a void folds on its day, its reason as its commitment', async () => {
  await fold('fold_issue', 7, 'invoice:invoice:issue', '2041-02-03', issued('T-2041-0002'))
  await fold('fold_void', 8, 'invoice:invoice:void', '2041-02-04', { invoice: 'T-2041-0002', voided: '2041-02-04', reason: commitment })
  assert.deepEqual(await one(`SELECT to_char(voided, 'YYYY-MM-DD') AS voided, reason FROM invoice.invoice WHERE id = 'T-2041-0002'`), { voided: '2041-02-04', reason: 'redacted' })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'invoice.invoice.reason' AND subject = 'T-2041-0002'`)).n, '1')
})
