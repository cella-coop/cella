// The finance scenario, end to end on a seeded Lanterne: expenses claimed,
// approved within a lead's budget and a gérante's limit and refused beyond
// them, charged and reimbursed; October's pay run prepared from approved
// time, approved and paid; draws within a member's limit and refused
// beyond it and once their capital is frozen; and the 2025 surplus
// allocated by the assembly's decision with the legal split. The books
// balance throughout. Run by `cella test e2e finance`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { capture, submit as claim } from '@cella/org-expense/api'
import { approve as approveExpense, reimburse } from '@cella/org-graft-expense-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveTime, submit as submitTime } from '@cella/org-timesheet/api'
import { draw } from '@cella/org-graft-account-member-transaction/api'
import { allocate } from '@cella/org-graft-account-transaction/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'
const sofia = 'sofia@lanterne.example'
const thomas = 'thomas@lanterne.example'

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
const balance = async (code: string) => Number((await one<{ b: string }>('SELECT balance AS b FROM account_transaction.balance WHERE code = $1', [code])).b)
const balanced = async () => {
  const t = await one<{ debit: string; credit: string }>('SELECT sum(debit) AS debit, sum(credit) AS credit FROM account_transaction.balance')
  assert.equal(t.debit, t.credit, 'the trial balance agrees')
}
const lines = (entry: string) =>
  all<{ account: string; side: string; cents: string }>('SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n', [entry])

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed carries July to September\'s pay runs, each posted in its carried-over entry', async () => {
  const runs = await all<{ month: string; gross: string; entry: string }>(
    `SELECT r.month, sum(cella.cents(p.gross)) AS gross, t.entry
     FROM payslip.run r JOIN payslip.payslip p ON p.month = r.month JOIN payslip_transaction.posting t ON t.month = r.month
     GROUP BY r.month, t.entry ORDER BY r.month`,
  )
  assert.deepEqual(runs, [
    { month: '2026-07', gross: '2600000', entry: 'je-0009' },
    { month: '2026-08', gross: '2600000', entry: 'je-0019' },
    { month: '2026-09', gross: '2600000', entry: 'je-0031' },
  ])
  assert.equal(await balance('512'), 39_296_00)
  await balanced()
})

test('Hugo approves Sofia\'s print proofs within his budget, which charges them; the claim is hers, not his', async () => {
  const own = await approveExpense({ expense: 'ex-0001' }, as(sofia))
  assert.equal(own.state, 'refused')
  const approved = await approveExpense({ expense: 'ex-0001' }, as(hugo))
  assert.equal(approved.state, 'settled')
  const entry = approved.state === 'settled' ? approved.value.entry ?? '' : ''
  assert.deepEqual(await lines(entry), [
    { account: '606', side: 'debit', cents: '15000' },
    { account: '44566', side: 'debit', cents: '3000' },
    { account: '421', side: 'credit', cents: '18000' },
  ])
  const logged = await one<{ rules: { owner: string }[] }>('SELECT rules FROM cella.log WHERE n = $1', [approved.state === 'settled' && approved.entry])
  assert.deepEqual(logged.rules.map((r) => r.owner).sort(), ['circle-expense-member', 'circle-member', 'expense', 'expense-transaction'])
})

test('beyond Hugo\'s 1 000 € a month, an approval is refused; beyond the gérante\'s 2 000 € limit too', async () => {
  const plotter = await capture({ member: sofia, day: '2026-10-24', label: 'Plotter repair', category: '606', net: 800_00, vat: 160_00, receipt: null }, as(sofia))
  assert.equal(plotter.state, 'settled')
  const id = plotter.state === 'settled' ? plotter.value.expense : ''
  assert.equal(id, 'ex-0005')
  assert.equal((await claim({ expense: id }, as(sofia))).state, 'settled')
  const over = await approveExpense({ expense: id }, as(hugo))
  assert.equal(over.state, 'refused')
  assert.match(reason(over), /hugo@lanterne\.example's approvals this month come to 114000 cents, beyond their approve-expense budget of 100000 cents/)

  const laptop = await capture({ member: thomas, day: '2026-10-24', label: 'Laptop', category: '606', net: 2_100_00, vat: 420_00, receipt: null }, as(thomas))
  const big = laptop.state === 'settled' ? laptop.value.expense : ''
  await claim({ expense: big }, as(thomas))
  const beyond = await approveExpense({ expense: big }, as(camille))
  assert.match(reason(beyond), /camille@lanterne\.example holds no mandate for approve-expense up to 2520\.00 €/)

  // Within her limit, the gérante approves the plotter Hugo's budget could
  // not.
  assert.equal((await approveExpense({ expense: id }, as(camille))).state, 'settled')
  await balanced()
})

test('Julien reimburses the print proofs from the bank, and what Sofia was owed is settled', async () => {
  const before = await balance('512')
  const camilleTries = await reimburse({ expense: 'ex-0001' }, as(camille))
  assert.match(reason(camilleTries), /holds no mandate for reimburse-expense/)
  const paid = await reimburse({ expense: 'ex-0001' }, as(julien))
  assert.equal(paid.state, 'settled')
  assert.equal(await balance('512'), before - 180_00)
  const again = await reimburse({ expense: 'ex-0001' }, as(julien))
  assert.equal(again.state, 'refused')
  assert.match(reason(again), /ex-0001 is reimbursed already/)
  const owed = await one<{ owed: string }>(
    `SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0) AS owed
     FROM transaction.line l JOIN expense_transaction.posting p ON p.entry = l.entry
     WHERE p.expense = 'ex-0001' AND l.account = '421'`,
  )
  assert.equal(owed.owed, '0')
  await balanced()
})

test('October\'s run waits for every member\'s approved month', async () => {
  await on('2026-11-02')
  const early = await generate({ month: '2026-10' }, as(julien))
  assert.equal(early.state, 'refused')
  assert.match(reason(early), /2026-10 is open, not approved: the run waits for it/)
})

test('once every October is approved, Julien prepares the run from the approved time', async () => {
  const members = (await all<{ member: string }>(`SELECT member FROM payslip.salary GROUP BY member ORDER BY member`)).map((r) => r.member)
  for (const m of members) {
    const submitted = await submitTime({ member: m, month: '2026-10' }, as(m))
    assert.equal(submitted.state, 'settled', reason(submitted))
    // The gérante approves time over the assembly, where everyone sits;
    // her own month, Brand's lead.
    const approved = await approveTime({ member: m, month: '2026-10' }, as(m === camille ? hugo : camille))
    assert.equal(approved.state, 'settled', reason(approved))
  }
  const run = await generate({ month: '2026-10' }, as(julien))
  assert.equal(run.state, 'settled', reason(run))
  assert.deepEqual(run.state === 'settled' && { payslips: run.value.payslips, gross: run.value.gross }, { payslips: 10, gross: 26_000_00 })
  const thomasSlip = await one<{ minutes: number; net: string }>(`SELECT minutes, cella.cents(net) AS net FROM payslip.payslip WHERE month = '2026-10' AND member = $1`, [thomas])
  const logged = await one<{ m: number }>(`SELECT sum(minutes)::int AS m FROM timesheet.entry WHERE member = $1 AND to_char(day, 'YYYY-MM') = '2026-10'`, [thomas])
  assert.equal(thomasSlip.minutes, logged.m)
  assert.equal(thomasSlip.net, '195000')
  const twice = await generate({ month: '2026-10' }, as(julien))
  assert.match(reason(twice), /the 2026-10 run was prepared on 2026-11-02/)
})

test('Camille approves the run, which accrues it in October; Julien pays it, and the books balance', async () => {
  const byJulien = await approveRun({ month: '2026-10' }, as(julien))
  assert.match(reason(byJulien), /holds no mandate for approve-payroll/)
  const approved = await approveRun({ month: '2026-10' }, as(camille))
  assert.equal(approved.state, 'settled')
  const accrual = approved.state === 'settled' ? approved.value.entry ?? '' : ''
  assert.equal((await one<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') AS date FROM transaction.entry WHERE id = $1`, [accrual])).date, '2026-10-31')
  assert.deepEqual(await lines(accrual), [
    { account: '641', side: 'debit', cents: '2600000' },
    { account: '645', side: 'debit', cents: '1040000' },
    { account: '421', side: 'credit', cents: '2028000' },
    { account: '431', side: 'credit', cents: '1612000' },
  ])

  const before = await balance('512')
  const paid = await pay({ month: '2026-10' }, as(julien))
  assert.equal(paid.state, 'settled')
  assert.equal(await balance('512'), before - 36_400_00)
  assert.equal(await balance('431'), 0)
  const twice = await pay({ month: '2026-10' }, as(julien))
  assert.match(reason(twice), /the 2026-10 run was paid on 2026-11-02/)
  await balanced()
})

test('Thomas draws 300 € within his 500 € limit; another 300 € is refused, and no one draws on his account but him', async () => {
  const within = await draw({ member: thomas, cents: 300_00 }, as(thomas))
  assert.equal(within.state, 'settled')
  const beyond = await draw({ member: thomas, cents: 300_00 }, as(thomas))
  assert.match(reason(beyond), /a draw of 30000 cents exceeds what is left of thomas@lanterne\.example's draw limit, 20000 of 50000 cents/)
  const other = await draw({ member: thomas, cents: 10_00 }, as(julien))
  assert.match(reason(other), /julien@lanterne\.example may draw only on their own account/)
  await balanced()
})

test('the 2025 surplus is allocated by d-2026-006, and posts the legal split', async () => {
  const wrong = await allocate({ allocation: 'al-2025', decision: 'd-2026-011' }, as(julien))
  assert.equal(wrong.state, 'refused')
  assert.match(reason(wrong), /d-2026-011 does not approve al-2025|d-2026-011 is not closed/)

  const done = await allocate({ allocation: 'al-2025', decision: 'd-2026-006' }, as(julien))
  assert.equal(done.state, 'settled')
  const entry = done.state === 'settled' ? done.value.entry : ''
  assert.deepEqual((await lines(entry)).sort((a, b) => a.account.localeCompare(b.account)), [
    { account: '1061', side: 'credit', cents: '921000' },
    { account: '1068', side: 'credit', cents: '1535000' },
    { account: '120', side: 'debit', cents: '6140000' },
    { account: '424', side: 'credit', cents: '2763000' },
    { account: '457', side: 'credit', cents: '921000' },
  ])
  assert.equal(await balance('120'), 0)
  const logged = await one<{ rules: { owner: string }[] }>('SELECT rules FROM cella.log WHERE n = $1', [done.state === 'settled' && done.entry])
  assert.deepEqual([...new Set(logged.rules.map((r) => r.owner))].sort(), ['account', 'account-decision', 'account-transaction', 'circle-decision-member'])

  const again = await allocate({ allocation: 'al-2025', decision: 'd-2026-006' }, as(julien))
  assert.match(reason(again), /the 2025 surplus was allocated on 2026-11-02/)

  const parts = await all<{ amount: string }>(`SELECT amount FROM account_payslip.work_share WHERE allocation = 'al-2025'`)
  assert.equal(parts.length, 10)
  assert.equal(parts.reduce((s, p) => s + Number(p.amount), 0), 27_630_00, 'the work share divides by salary to the cent')
  await balanced()
})

test('a member who leaves has their capital frozen, and draws nothing more', async () => {
  // Stands in for the exit write, whichever makes it: freezing is a
  // trigger on the member's status, in that write's transaction.
  await su.query(`UPDATE member.member SET status = 'exited' WHERE address = $1`, [sofia])
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE holder = $1`, [sofia])).frozen, true)
  const late = await draw({ member: sofia, cents: 10_00 }, as(sofia))
  assert.equal(late.state, 'refused')
})
