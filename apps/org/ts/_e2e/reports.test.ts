// The reports scenario, end to end on a seeded Lanterne, read through the
// analytics shell as the report feat reads it: every span's income
// statement and balance sheet equal the books' `statement` to the cent,
// and reconcile with the trial balance; months add up to their quarter and
// quarters to their year; a statement compares a span with the one before
// and opens a line on its accounts, a member's capital summed into 1013;
// each project's margin, burn and watch on 25 October, an approved
// expense taking its cost off the margin and onto the income statement;
// a custom report saved, run and refused; and the pages and the home's
// pins, through the built server. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { approve } from '@cella/org-graft-expense-transaction/api'
import { custom, draw, margins, save, spans, statement } from '@cella/org-report/api'
import type { Rubric, Statement } from '@cella/org-report/models'
import type { Deps } from '@cella/org-db'
import { scoped } from '@cella/org-analytics'
import { reader, sign } from './lanterne.ts'
import { reading, type Reading } from './port.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const server = new Shell(su)
let app: pg.Client
let shell: Reading

const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]

// The books' own sheet by rubric over a span; the balance sheet's up to
// its end.
async function sheet(kind: 'income' | 'balance', since: string | null, until: string) {
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

const figure = (rs: Rubric[], id: string, i = 0) => rs.find((r) => r.id === id)?.amounts[i] ?? null
// The port as Camille, a member who reads every circle by open books,
// reads it, as the server hands it to her pages.
const port = () => scoped(shell.analytics, reader(app, camille))

// A page as text, its tags gone.
const read = async (path: string, actor: string) => {
  const { status, text } = await server.page(path, actor)
  assert.equal(status, 200, path)
  return text.replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ')
}

before(async () => {
  await su.connect()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '2026-10-25'`)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
  shell = await reading(su, 20, '2026-10-25')
})

after(async () => {
  await server.stop()
  shell?.stop()
  await app.end()
  await su.end()
})

test('every span\'s statements, read through the port, are the books\' to the cent', async () => {
  const all = await spans(port())
  assert.equal(all.length, 9, 'from July 2026: six months, two quarters and a year')
  for (const span of all) {
    for (const kind of ['income', 'balance'] as const) {
      const { rubrics } = await statement(port(), kind, span)
      const [now, was] = [await sheet(kind, span.since, span.until), await sheet(kind, span.before_since, span.before_until)]
      for (const r of rubrics.filter((x) => x.kind !== 'heading')) {
        assert.equal(r.amounts[0], now[r.id], `${kind} ${span.id} ${r.id}`)
        assert.equal(r.amounts[1], was[r.id], `${kind} ${span.before} ${r.id}`)
      }
      // A line left out is one nothing posted to in either span.
      for (const id of Object.keys(now).filter((id) => !rubrics.some((r) => r.id === id))) {
        assert.ok(!now[id] && !was[id], `${kind} ${span.id} leaves out ${id}`)
      }
    }
  }
})

test('2026\'s statements reconcile with the trial balance: income less expenses, and a balance sheet that balances', async () => {
  const t = await trial()
  const year = (await spans(port())).find((s) => s.id === '2026')
  assert.ok(year)
  const income = (await statement(port(), 'income', year)).rubrics
  assert.equal(figure(income, 'result'), -(t.income + t.expense))
  assert.equal(figure(income, 'result'), -80_00)
  assert.equal(figure(income, 'production-sold'), 121_200_00)
  const balance = (await statement(port(), 'balance', year)).rubrics
  assert.equal(figure(balance, 'assets-total'), figure(balance, 'liabilities-total'))
  assert.equal(figure(balance, 'assets-total'), t.asset)
  assert.equal(figure(balance, 'assets-total'), 97_080_00)
  assert.equal(figure(balance, 'to-allocate'), 61_400_00, 'the 2025 result is not allocated yet')
  assert.equal(figure(balance, 'cash'), 39_296_00)
})

test('months add up to their quarter, and quarters to their year', async () => {
  const all = await spans(port())
  const result = async (id: string) => figure((await statement(port(), 'income', all.find((s) => s.id === id)!)).rubrics, 'result') ?? 0
  assert.equal((await result('2026-07')) + (await result('2026-08')) + (await result('2026-09')), await result('2026-Q3'))
  assert.equal((await result('2026-10')) + (await result('2026-11')) + (await result('2026-12')), await result('2026-Q4'))
  assert.equal((await result('2026-Q3')) + (await result('2026-Q4')), await result('2026'))
  assert.equal(await result('2026-Q3'), -22_860_00)
})

test('a statement compares a span with the one before, opens a line on its accounts, and shows no member\'s capital account', async () => {
  const s = (await draw(port(), app, 'income', new URLSearchParams({ span: '2026-10' })))?.drawn as Statement
  assert.deepEqual(s.columns, ['2026-10', '2026-09'])
  const sold = s.rubrics.find((r) => r.id === 'production-sold')
  assert.deepEqual(sold?.amounts, [25_800_00, 34_100_00])
  assert.deepEqual(sold?.accounts, [{ code: '706', label: 'Prestations de services', href: '/accounts/706', amounts: [25_800_00, 34_100_00] }])
  assert.equal(s.rubrics.find((r) => r.id === 'goods-sold'), undefined, 'a line nothing posted to is left out')
  assert.deepEqual(s.rubrics.find((r) => r.id === 'result')?.amounts, [22_780_00, -5_320_00])
  const b = (await draw(port(), app, 'balance', new URLSearchParams({ span: '2026-10' })))?.drawn as Statement
  const codes = b.rubrics.flatMap((r) => r.accounts ?? []).map((a) => a.code)
  assert.ok(codes.includes('1013'))
  assert.ok(!codes.some((c) => c.startsWith('1013') && c !== '1013'), 'a member\'s capital account is summed into 1013')
  const year = (await draw(port(), app, 'income', new URLSearchParams()))?.drawn as Statement
  assert.equal(year.span.id, '2026', 'with no span asked, the year the scope\'s day is in')
  const head = (await draw(port(), app, 'income', new URLSearchParams()))?.head
  assert.deepEqual(head, (await all<{ n: number; hash: string }>(`SELECT n::int AS n, encode(hash, 'hex') AS hash FROM cella.head`))[0])
})

test('each project\'s margin, burn and watch, on 25 October', async () => {
  const { margins: m } = await margins(port())
  assert.equal(m.day, '2026-10-25')
  assert.deepEqual(m.threshold, { burn: 90, margin: 20 })
  assert.deepEqual(Object.fromEntries(m.projects.map((x) => [x.project, x.watch])), {
    'clairval-site': 'on track',
    'ferrand-packaging': 'budget spent',
    'halles-shop': 'on track',
    'mauve-posters': 'on track',
    'nuvola-retainer': 'on track',
    'ondine-shop': 'archived',
    'terres-report': 'over budget',
    'velo-identity': 'on track',
  })
  const ferrand = m.projects.find((x) => x.project === 'ferrand-packaging')!
  assert.equal(ferrand.invoiced, 14_000_00)
  // 172 hours at 23,64 € an hour, September's pay over its hours.
  assert.equal(ferrand.cost, 4_066_08)
  assert.equal(ferrand.margin, 14_000_00 - 4_066_08)
  assert.equal(ferrand.burn, 98.3)
  // What each project invoiced, cost and spent, summed by the slices' own
  // reads, is what the margins sum.
  const [whole] = await all<{ invoiced: string; cost: string; spent: string }>(`SELECT
      (SELECT coalesce(sum(net), 0) FROM invoice_project.invoiced) AS invoiced,
      (SELECT coalesce(sum(cost), 0) FROM project_timesheet.burn) AS cost,
      (SELECT coalesce(sum(approved), 0) FROM expense_project.spent) AS spent`)
  assert.equal(
    m.projects.reduce((s, x) => s + x.margin, 0),
    Number(whole.invoiced) - Number(whole.cost) - Number(whole.spent),
  )
})

test('Hugo approves the print proofs billed on to Ferrand: its margin loses them, October\'s income statement gains them', async () => {
  const ferrand = async () => (await margins(port())).margins.projects.find((x) => x.project === 'ferrand-packaging')!
  const october = (await spans(port())).find((s) => s.id === '2026-10')!
  const was = await ferrand()
  const before = (await statement(port(), 'income', october)).rubrics
  const approved = await approve({ expense: 'ex-0001' }, as(hugo))
  assert.equal(approved.state, 'settled')
  const now = await ferrand()
  assert.equal(now.expenses, was.expenses + 180_00)
  assert.equal(now.margin, was.margin - 180_00)
  const after = (await statement(port(), 'income', october)).rubrics
  assert.equal(figure(after, 'external'), (figure(before, 'external') ?? 0) + 150_00, 'net of the VAT, which is deductible')
  assert.equal(figure(after, 'result'), (figure(before, 'result') ?? 0) - 150_00)
})

test('a member saves a report of their own, which runs through the port; one reading past the catalog is refused and never saved', async () => {
  const definition = {
    from: { p: 'project.projects', f: 'project_timesheet.forecasts' },
    join: [['f.project', 'p.id']] as [string, string][],
    fields: ['p.circle'],
    measures: { budget: { fn: 'sum' as const, of: 'p.budget' }, spent: { fn: 'sum' as const, of: 'f.spent' } },
    order: ['p.circle'],
    chart: { by: 'p.circle', value: 'spent' },
  }
  const saved = await save(port(), { id: 'spent-by-circle', title: 'Spent by circle', caption: '', definition }, as(camille))
  assert.equal(saved.state, 'settled', saved.state === 'refused' ? saved.reason : '')
  const drawn = await draw(port(), app, 'spent-by-circle')
  const { custom: run } = await custom(port(), definition)
  assert.deepEqual(drawn?.drawn, run)
  const [time] = await all<{ spent: string }>(`SELECT sum(spent) AS spent FROM project_timesheet.burn`)
  assert.equal(run.bars.reduce((s, b) => s + b.value, 0), Number(time.spent))
  await assert.rejects(
    save(port(), { id: 'lines', title: 'Lines', caption: '', definition: { from: { l: 'transaction.line' }, fields: ['l.amount'] } }, as(camille)),
    /the analytics port refuses this report: transaction\.line is no view the slices publish/,
  )
  assert.equal((await all(`SELECT id FROM report.report WHERE id = 'lines'`)).length, 0)
})

test('the pages draw each report and say what they read', async () => {
  await server.start('2026-10-25', shell.env)
  const list = await read('/reports', camille)
  for (const title of ['Income statement', 'Balance sheet', 'Project margins', 'Federation figures', 'Spent by circle']) {
    assert.ok(list.includes(title), title)
  }
  const income = await read('/reports/income?span=2026-10', camille)
  assert.match(income, /Income statement, 2026-10 against 2026-09/)
  assert.match(income, /read at the log's entry \d+/)
  assert.match(income, /Prestations de services/)
  const margin = await read('/reports/margins', camille)
  assert.match(margin, /Projects on 2026-10-25/)
  assert.match(margin, /budget spent/)
  const federation = await read('/reports/federation', camille)
  assert.match(federation, /The figures are drawn once a year's surplus is distributed/)
  await server.stop()
  await server.start('2026-10-25')
  assert.match(await read('/reports/margins', camille), /the analytics shell is not running/)
})
