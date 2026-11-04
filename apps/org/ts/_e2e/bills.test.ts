// The bills scenario, end to end on a seeded Lanterne: Julien records a
// supplier's bill, its lines counted as an invoice's are; the gérante
// approves it within her limit, not Julien who recorded it, which charges
// it to the books and moves the income statement by its net; Julien pays
// it from the bank within his, which leaves the income statement where it
// was. Anyone without the power, an approval or a payment beyond a limit,
// a payment before the approval and a second payment are refused. The
// books balance throughout. Run by `cella test e2e bills`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { record } from '@cella/org-bill/api'
import { approve, pay } from '@cella/org-graft-bill-transaction/api'
import type { Incoming } from '@cella/org-bill/models'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const balance = async (code: string) => Number((await one<{ b: string | null }>('SELECT balance AS b FROM account_transaction.balance WHERE code = $1', [code]))?.b ?? 0)
const balanced = async () => {
  const t = await one<{ debit: string; credit: string }>('SELECT sum(debit) AS debit, sum(credit) AS credit FROM account_transaction.balance')
  assert.equal(t.debit, t.credit, 'the trial balance agrees')
}
const lines = (entry: string) =>
  all<{ account: string; side: string; cents: string }>('SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n', [entry])
// The year's result on the income statement, in cents: income less
// expenses.
const result = async () =>
  Number((await one<{ amount: string }>(`SELECT amount FROM account_transaction.statement('income', '2026-01-01', '2026-12-31') WHERE id = 'result'`)).amount)

const licences: Incoming = {
  supplier: 'Logiciels Vauban',
  reference: 'LV-26-0412',
  issued: '2026-10-22',
  label: 'Design licences, October',
  category: '626',
  lines: [
    { description: 'Layout seat, a month', quantity: '3', unit_price: 59_99, vat_rate: 2000 },
    { description: 'Type library, a month', quantity: '1', unit_price: 24_50, vat_rate: 2000 },
  ],
}
// 3 × 59,99 € and 24,50 €; VAT 35,99 € and 4,90 €.
const net = 204_47
const vat = 40_89

let bill = ''
let before401 = 0

before(async () => {
  await su.connect()
  // The host stands in for an exit around the notary, as only a superuser may.
  await su.query('SET cella.unbound = on')
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed carries two bills, recorded and not yet in the books', async () => {
  const bills = await all<{ id: string; status: string; total: string }>('SELECT id, status, cella.cents(total) AS total FROM bill.bill ORDER BY id')
  assert.deepEqual(bills, [
    { id: 'bi-0001', status: 'recorded', total: '144000' },
    { id: 'bi-0002', status: 'recorded', total: '108000' },
  ])
  assert.deepEqual(await all('SELECT * FROM bill_transaction.posting'), [])
  before401 = await balance('401')
})

test('Julien records a supplier\'s bill, its amounts counted from its lines; recorded again, it merges', async () => {
  const hugoTries = await record(licences, as(hugo))
  assert.match(reason(hugoTries), /holds no mandate for record-bill/)

  const recorded = await record(licences, as(julien))
  assert.equal(recorded.state, 'settled', reason(recorded))
  assert.ok(recorded.state === 'settled')
  bill = recorded.value.bill
  assert.deepEqual(recorded.value, { bill, circle: 'ag', net, vat, total: net + vat, merged: false })

  const again = await record(licences, as(julien))
  assert.ok(again.state === 'settled')
  assert.deepEqual(again.value, { bill, circle: 'ag', net, vat, total: net + vat, merged: true })
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM bill.bill WHERE supplier = $1', [licences.supplier])).n, '1')

  const due = await one<{ due: string; recorder: string }>(`SELECT to_char(due, 'YYYY-MM-DD') AS due, recorder FROM bill.bill WHERE id = $1`, [bill])
  assert.deepEqual(due, { due: '2026-11-21', recorder: julien })
  // Recording posts nothing: the bill is not in the books until approved.
  assert.equal(await balance('401'), before401)
})

test('a bill is paid only once approved', async () => {
  const early = await pay({ bill }, as(julien))
  assert.equal(early.state, 'refused')
  assert.match(reason(early), new RegExp(`${bill} is recorded, and cannot become paid`))
})

test('the gérante approves it, which charges it to the books and lowers the year\'s result by its net', async () => {
  const before = await result()
  // Who recorded it does not approve it too; a lead holds no approve-bill.
  const julienTries = await approve({ bill }, as(julien))
  assert.match(reason(julienTries), new RegExp(`julien@lanterne\\.example recorded ${bill}, and may not approve it too`))
  const hugoTries = await approve({ bill }, as(hugo))
  assert.match(reason(hugoTries), /hugo@lanterne\.example holds no mandate for approve-bill/)

  const approved = await approve({ bill }, as(camille))
  assert.equal(approved.state, 'settled', reason(approved))
  const entry = approved.state === 'settled' ? approved.value.entry ?? '' : ''
  assert.deepEqual(await lines(entry), [
    { account: '626', side: 'debit', cents: String(net) },
    { account: '44566', side: 'debit', cents: String(vat) },
    { account: '401', side: 'credit', cents: String(net + vat) },
  ])
  const logged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = $1', [approved.state === 'settled' && approved.entry])
  assert.deepEqual(logged.guards.map((r) => r.owner).sort(), ['bill', 'bill-transaction', 'membership'])

  assert.equal(await result(), before - net)
  assert.equal(await balance('401'), before401 - (net + vat))
  await balanced()
})

test('Julien pays it from the bank: the supplier is settled and the result stays where it was', async () => {
  const before = await result()
  const bank = await balance('512')
  const camilleTries = await pay({ bill }, as(camille))
  assert.match(reason(camilleTries), /holds no mandate for pay-supplier/)

  const paid = await pay({ bill }, as(julien))
  assert.equal(paid.state, 'settled', reason(paid))
  const entry = paid.state === 'settled' ? paid.value.entry ?? '' : ''
  assert.deepEqual(await lines(entry), [
    { account: '401', side: 'debit', cents: String(net + vat) },
    { account: '512', side: 'credit', cents: String(net + vat) },
  ])
  assert.equal(await balance('512'), bank - (net + vat))
  assert.equal(await balance('401'), before401)
  assert.equal(await result(), before)

  const again = await pay({ bill }, as(julien))
  assert.equal(again.state, 'refused')
  assert.match(reason(again), new RegExp(`${bill} is paid already`))
  await balanced()
})

test('beyond the gérante\'s 5 000 € an approval is refused, and beyond Julien\'s 3 000 € a payment', async () => {
  const press = (reference: string, unit_price: number): Incoming => ({
    supplier: 'Imprimerie du Parc',
    reference,
    issued: '2026-10-23',
    label: 'Catalogue print run',
    category: '606',
    lines: [{ description: 'Catalogue, 24 pages, a thousand', quantity: '1', unit_price, vat_rate: 2000 }],
  })
  const big = await record(press('FA-2026-1203', 5_000_00), as(julien))
  const huge = big.state === 'settled' ? big.value.bill : ''
  const over = await approve({ bill: huge }, as(camille))
  assert.match(reason(over), /camille@lanterne\.example holds no mandate for approve-bill up to 6000\.00 €/)

  const run = await record(press('FA-2026-1204', 3_500_00), as(julien))
  const within = run.state === 'settled' ? run.value.bill : ''
  assert.equal((await approve({ bill: within }, as(camille))).state, 'settled')
  const beyond = await pay({ bill: within }, as(julien))
  assert.match(reason(beyond), /julien@lanterne\.example holds no mandate for pay-supplier up to 4200\.00 €/)
  await balanced()
})
