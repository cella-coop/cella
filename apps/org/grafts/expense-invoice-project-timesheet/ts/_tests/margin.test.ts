// Project margins, on a database holding the app's core, the expense,
// invoice, project and timesheet feats, the grafts joining two of them
// and this one: what a project invoiced less what its time cost and its
// approved expenses; its budget burn and the forecasts at completion at
// the pace so far; and whether it is watched, its budget spent past the
// threshold while under way, its forecast over its budget, or a thin
// margin. Run by `cella test slice expense-invoice-project-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

async function project(id: string, started: string, due: string | null, budget: number | null) {
  await db.query(`INSERT INTO project.project (id, title, started, due, budget) VALUES ($1, $1, $2, $3, cella.amount($4))`, [id, started, due, budget])
}

// `hours` of time from a day on, billable or not, booked to a project, in
// days of at most eight hours.
async function time(project: string, day: string, hours: number, billable = true) {
  for (let i = 0; i * 8 < hours; i++) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO timesheet.entry (member, day, minutes, billable) VALUES ('ana@lanterne.coop', $1::date + $2::int, $3, $4) RETURNING id`,
      [day, i, Math.min(8, hours - i * 8) * 60, billable],
    )
    await db.query('INSERT INTO project_timesheet.booking (entry, project) VALUES ($1, $2)', [rows[0].id, project])
  }
}

let number = 0
async function invoice(project: string, net: number, voided = false) {
  const id = `F-${++number}`
  await db.query('BEGIN')
  await db.query(
    `INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, label, net, vat, total, voided, reason)
     VALUES ($1, 'F', $2, '2026-09-01', '2026-10-01', 'client', 'work', cella.amount($3), NULL, cella.amount($3), $4, $5)`,
    [id, number, net, voided ? '2026-09-02' : null, voided ? 'mistake' : null],
  )
  await db.query(
    `INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate) VALUES ($1, 1, 'work', 1, cella.amount($2), cella.amount($2), 0)`,
    [id, net],
  )
  await db.query('COMMIT')
  await db.query('INSERT INTO invoice_project.charge (invoice, project) VALUES ($1, $2)', [id, project])
}

async function expense(project: string, net: number, status: 'submitted' | 'approved') {
  const decided = status === 'approved' ? ['2026-09-10', 'lead@lanterne.coop'] : [null, null]
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO expense.expense (member, day, label, category, net, status, submitted, decided, decider)
     VALUES ('ana@lanterne.coop', '2026-09-05', 'train', '6251', cella.amount($1), $2, '2026-09-06', $3, $4) RETURNING id`,
    [net, status, ...decided],
  )
  await db.query('INSERT INTO expense_project.rebill (expense, project) VALUES ($1, $2)', [rows[0].id, project])
}

const margins = async (day: string) =>
  Object.fromEntries(
    (await db.query('SELECT * FROM expense_invoice_project_timesheet.margin($1)', [day])).rows.map((r) => [r.project, r]),
  )

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO invoice.series (name, next) VALUES ('F', 1)`)
  await db.query(`INSERT INTO project_timesheet.rate (since, hourly) VALUES ('2026-01-01', cella.amount(8000))`)
  await db.query(`INSERT INTO project_timesheet.cost (since, hourly) VALUES ('2026-01-01', cella.amount(2500))`)
  await db.query(`INSERT INTO expense_invoice_project_timesheet.threshold (since, burn, margin) VALUES ('2026-01-01', 90, 20)`)

  // A shop, 1 September to 30 November, 10 000 € budget: 40 billable
  // hours (3 200 € spent of the budget, 1 000 € of cost) and 8 internal
  // (200 € of cost); 6 000 € invoiced, an invoice voided; a 100 €
  // approved expense and a pending one.
  await project('shop', '2026-09-01', '2026-11-30', 10_000_00)
  await time('shop', '2026-09-02', 40)
  await time('shop', '2026-09-03', 8, false)
  await invoice('shop', 6_000_00)
  await invoice('shop', 2_000_00, true)
  await expense('shop', 100_00, 'approved')
  await expense('shop', 900_00, 'submitted')

  // A poster, 1 to 31 October, 2 000 € budget, 24 billable hours: 1 920 €
  // spent, 96 %, while under way.
  await project('poster', '2026-10-01', '2026-10-31', 2_000_00)
  await time('poster', '2026-10-02', 24)

  // A site, 1 October to 30 November, 4 000 € budget, 30 billable hours:
  // 2 400 € spent, 60 %, by 20 October, a third of its span; at that pace
  // it spends about 7 600 €, over its budget.
  await project('site', '2026-10-01', '2026-11-30', 4_000_00)
  await time('site', '2026-10-02', 30)

  // A retainer with no due day and no budget: 1 000 € invoiced against
  // 35 hours, 875 € of cost, keeps 12.5 %.
  await project('retainer', '2026-01-01', null, null)
  await time('retainer', '2026-10-05', 35)
  await invoice('retainer', 1_000_00)
})

after(async () => {
  await db.end()
})

test('a margin is what a project invoiced less its time\'s cost and its approved expenses', async () => {
  const m = (await margins('2026-10-16')).shop
  assert.equal(Number(m.invoiced), 6_000_00, 'a voided invoice is left out')
  assert.equal(Number(m.cost), 1_200_00, 'every hour at the cost rate, billable or not')
  assert.equal(Number(m.expenses), 100_00, 'only approved expenses')
  assert.equal(Number(m.margin), 4_700_00)
  assert.equal(Number(m.percent), 78.3)
})

test('the burn is billable time at the rate against the budget, and the forecasts run at the pace so far', async () => {
  // 16 October is 45 of the shop's 90 days.
  const m = (await margins('2026-10-16')).shop
  assert.equal(Number(m.spent), 3_200_00)
  assert.equal(Number(m.burn), 32)
  assert.equal(Number(m.forecast), 6_400_00)
  assert.equal(Number(m.landing), 10_000_00 - 2_600_00)
  assert.equal(m.watch, 'on track')
  const done = (await margins('2026-12-01')).shop
  assert.equal(Number(done.forecast), 3_200_00, 'from its due day on, the forecast is what it spent')
})

test('a project is watched when its burn passes the threshold under way, its forecast passes its budget, or its margin is thin', async () => {
  const due = await margins('2026-10-31')
  assert.equal(due.poster.watch, 'on track', 'on its due day the poster is no longer under way, and 1 920 € is within 2 000 €')
  const mid = await margins('2026-10-20')
  assert.equal(mid.poster.watch, 'budget spent')
  assert.equal(mid.site.watch, 'over budget')
  assert.equal(mid.retainer.watch, 'thin margin')
  assert.equal(mid.retainer.forecast, null, 'with no due day, no forecast')
  await db.query(`UPDATE project.project SET archived = '2026-10-21' WHERE id = 'poster'`)
  assert.equal((await margins('2026-10-22')).poster.watch, null, 'an archived project is watched no more')
})
