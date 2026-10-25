// The statements scenario, end to end on a seeded Lanterne: the income
// statement and the balance sheet reconcile with the trial balance, to the
// cent; months add up to their quarter and quarters to their year; the
// page's statements compare a span with the one before and open a line on
// its accounts; and each project's margin, burn and watch follow its
// invoices, its time and its expenses, an approved expense taking its
// cost off the margin and onto the income statement in the same write.
// Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { figures, statements } from '@cella/org-graft-account-transaction/api'
import { margins } from '@cella/org-graft-expense-invoice-project-timesheet/api'
import { approve } from '@cella/org-graft-expense-transaction/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const hugo = 'hugo@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]

// The app's connection reading as `actor`, as the server reads for the
// signed-in member: what the policies let them see.
const reading = async (actor: string) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
  return app
}

// A sheet's figures by rubric over a span; the balance sheet's up to its end.
async function sheet(kind: 'income' | 'balance', since: string, until: string) {
  const rows = await all<{ id: string; amount: string | null }>('SELECT id, amount FROM account_transaction.statement($1, $2, $3)', [
    kind,
    kind === 'balance' ? null : since,
    until,
  ])
  return Object.fromEntries(rows.map((r) => [r.id, r.amount === null ? null : Number(r.amount)]))
}

// The trial balance's signed balances, debit positive, summed by kind.
async function trial() {
  const rows = await all<{ kind: string; balance: string }>('SELECT kind, sum(balance) AS balance FROM account_transaction.balance GROUP BY kind')
  return Object.fromEntries(rows.map((r) => [r.kind, Number(r.balance)]))
}

before(async () => {
  await su.connect()
  await on('2026-10-25')
})

after(async () => {
  await app.end()
  await su.end()
})

test('2026\'s income statement reconciles with the trial balance: income less expenses, to the cent', async () => {
  const t = await trial()
  const year = await sheet('income', '2026-01-01', '2026-12-31')
  assert.equal(year.result, -(t.income + t.expense))
  assert.equal(year.result, -80_00)
  assert.equal(year['production-sold'], 121_200_00)
  assert.equal(year['operating-expenses-total'], 121_280_00)
})

test('the balance sheet at the year\'s end balances, and its totals are the trial balance\'s', async () => {
  const t = await trial()
  const end = await sheet('balance', '2026-01-01', '2026-12-31')
  assert.equal(end['assets-total'], end['liabilities-total'])
  assert.equal(end['assets-total'], t.asset)
  assert.equal(end['assets-total'], 97_080_00)
  assert.equal(end['liabilities-total'], -(t.liability + t.equity + t.income + t.expense))
  assert.equal(end['period-result'], -80_00)
  assert.equal(end['to-allocate'], 61_400_00, 'the 2025 result is not allocated yet')
  assert.equal(end.cash, 39_296_00)
})

test('months add up to their quarter, and quarters to their year', async () => {
  const f = await figures(await reading(hugo))
  assert.equal(f['2026-07'].result + f['2026-08'].result + f['2026-09'].result, f['2026-Q3'].result)
  assert.equal(f['2026-10'].result + f['2026-11'].result + f['2026-12'].result, f['2026-Q4'].result)
  assert.equal(f['2026-Q3'].result + f['2026-Q4'].result, f['2026'].result)
  assert.equal(f['2026-Q3'].result, -22_860_00)
  assert.equal(f['2026-Q4'].assets, f['2026'].assets, 'a quarter and its year end on one day')
})

test('the page compares a span with the one before, and opens a line on its accounts', async () => {
  const s = await statements(await reading(hugo), '2026-10')
  assert.ok(s)
  assert.deepEqual(s.columns, ['2026-10', '2026-09'])
  const sold = s.income.find((r) => r.id === 'production-sold')
  assert.deepEqual(sold?.amounts, [25_800_00, 34_100_00])
  assert.deepEqual(sold?.accounts, [{ code: '706', label: 'Prestations de services', href: '/accounts/706', amounts: [25_800_00, 34_100_00] }])
  assert.equal(s.income.find((r) => r.id === 'goods-sold'), undefined, 'a line nothing posted to is left out')
  assert.deepEqual(s.income.find((r) => r.id === 'result')?.amounts, [22_780_00, -5_320_00])
  const assets = s.balance.find((r) => r.id === 'assets-total')?.amounts
  const liabilities = s.balance.find((r) => r.id === 'liabilities-total')?.amounts
  assert.deepEqual(assets, liabilities)
  assert.equal(await statements(await reading(hugo), '2031-Q1'), null)
})

test('each project\'s margin, burn and watch, on 25 October', async () => {
  const m = await margins(await reading(hugo), '2026-10-25')
  assert.deepEqual(
    Object.fromEntries(Object.entries(m).map(([p, x]) => [p, x.watch])),
    {
      'halles-shop': 'on track',
      'clairval-site': 'on track',
      'nuvola-retainer': 'on track',
      'mauve-posters': 'on track',
      'velo-identity': 'on track',
      'ferrand-packaging': 'budget spent',
      'terres-report': 'over budget',
      'ondine-shop': null,
    },
  )
  const ferrand = m['ferrand-packaging']
  assert.equal(ferrand.invoiced, 14_000_00)
  // 172 hours at 23,64 € an hour, September's pay over its hours.
  assert.equal(ferrand.cost, 4_066_08)
  assert.equal(ferrand.margin, 14_000_00 - 4_066_08)
  assert.equal(ferrand.burn, 98.3)
  const total = await all<{ margin: string }>(`SELECT sum(margin) AS margin FROM expense_invoice_project_timesheet.margin('2026-10-25')`)
  assert.equal(Object.values(m).reduce((s, x) => s + x.margin, 0), Number(total[0].margin))
})

test('Hugo approves the print proofs billed on to Ferrand: its margin loses them, October\'s income statement gains them', async () => {
  const before = (await margins(await reading(hugo), '2026-10-25'))['ferrand-packaging']
  const october = await sheet('income', '2026-10-01', '2026-10-31')
  const approved = await approve({ expense: 'ex-0001' }, as(hugo))
  assert.equal(approved.state, 'settled')
  const after = (await margins(await reading(hugo), '2026-10-25'))['ferrand-packaging']
  assert.equal(after.expenses, before.expenses + 180_00)
  assert.equal(after.margin, before.margin - 180_00)
  const now = await sheet('income', '2026-10-01', '2026-10-31')
  assert.equal(now.external, (october.external ?? 0) + 150_00, 'net of the VAT, which is deductible')
  assert.equal(now.result, (october.result ?? 0) - 150_00)
  const end = await sheet('balance', '2026-01-01', '2026-12-31')
  assert.equal(end['assets-total'], end['liabilities-total'])
})
