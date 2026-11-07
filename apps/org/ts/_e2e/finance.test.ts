// The finance scenario, end to end on a seeded Lanterne: expenses claimed,
// approved within a lead's budget and a gérante's limit and refused beyond
// them, charged and reimbursed; October's pay run prepared from every
// worker's approved time, Inès's though she is no member, approved and
// paid; draws within a member's limit and refused
// beyond it and once they left; and the 2025 surplus
// approved by the assembly's motion and distributed with the legal
// split. The log commits to each payslip's figures, a draw's amount and
// an entry's time. The books balance throughout. Run by `cella test e2e finance`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { capture, submit as claim } from '@cella/org-expense/api'
import { approve as approveExpense, reimburse } from '@cella/org-graft-expense-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveTime, log as logTime, submit as submitTime } from '@cella/org-timesheet/api'
import { draw } from '@cella/org-graft-account-membership-transaction/api'
import { approve as approveSplit } from '@cella/org-patronage/api'
import { distribute } from '@cella/org-graft-patronage-transaction/api'
import { reacting } from '../src/lib/server/slices.ts'
import { done as made, type Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

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

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
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
  // The host stands in for an exit around the notary, as only a superuser may.
  await su.query('SET cella.unbound = on')
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
  const logged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = $1', [approved.state === 'settled' && approved.entry])
  assert.deepEqual(logged.guards.map((r) => r.owner).sort(), ['expense', 'expense-membership', 'expense-transaction', 'membership'])
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
  assert.match(reason(beyond), /the actor holds no mandate for approve-expense up to 2520\.00 €/)

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

test('October\'s run waits for every worker\'s approved month', async () => {
  await on('2026-11-02')
  const early = await generate({ month: '2026-10' }, as(julien))
  assert.equal(early.state, 'refused')
  assert.match(reason(early), /2026-10 in web is open, not approved: the run waits for it/)
})

test('once every October is approved, Julien prepares the run from the approved time, Inès\'s with the members\'', async () => {
  // Each worker submits by their employment, as the shell does; Inès is
  // no member, and holds no mandate.
  const members = (await all<{ member: string }>(`SELECT member FROM payslip.salary WHERE "from" <= '2026-10-01' GROUP BY member ORDER BY member`)).map((r) => r.member)
  for (const m of members) {
    // A month of each circle the worker logged October's time for.
    for (const { circle } of await all<{ circle: string }>(`SELECT circle FROM timesheet.period WHERE member = $1 AND month = '2026-10'`, [m])) {
      const submitted = await submitTime({ member: m, month: '2026-10', circle }, as(m))
      assert.equal(submitted.state, 'settled', reason(submitted))
      // The gérante approves time over the assembly, where everyone sits;
      // her own month, Brand's lead.
      const approved = await approveTime({ member: m, month: '2026-10', circle }, as(m === camille ? hugo : camille))
      assert.equal(approved.state, 'settled', reason(approved))
    }
  }
  const run = await generate({ month: '2026-10' }, as(julien))
  assert.equal(run.state, 'settled', reason(run))
  assert.deepEqual(run.state === 'settled' && { payslips: run.value.payslips, gross: run.value.gross }, { payslips: 11, gross: 28_200_00 })
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
    { account: '641', side: 'debit', cents: '2820000' },
    { account: '645', side: 'debit', cents: '1128000' },
    { account: '421', side: 'credit', cents: '2199600' },
    { account: '431', side: 'credit', cents: '1748400' },
  ])

  const before = await balance('512')
  const paid = await pay({ month: '2026-10' }, as(julien))
  assert.equal(paid.state, 'settled')
  assert.equal(await balance('512'), before - 39_480_00)
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

test('the log commits to pay, time and capital: October\'s payslips, Thomas\'s draw and the time he logs open to their figures, his time to him alone', async () => {
  const logged = (op: string) => one<{ n: number; form: Record<string, any> }>('SELECT n, form FROM cella.log WHERE op = $1 ORDER BY n DESC LIMIT 1', [op])
  const opened = async (n: number) => (await one<{ o: Record<string, any> }>('SELECT cella.opened($1) AS o', [n])).o
  const commitment = /^[0-9a-f]{64}$/

  const run = await logged('payslip:run:generate')
  assert.equal(run.form.figures.length, 11)
  for (const slip of run.form.figures) {
    for (const figure of ['gross', 'employee', 'employer', 'net']) assert.match(slip[figure].$commit, commitment)
  }
  assert.equal(run.form.gross, 28_200_00, 'the run\'s totals, figures of the books, stay as given')
  const his = (await opened(run.n)).figures.find((f: { member: string }) => f.member === thomas)
  assert.deepEqual(his, { member: thomas, gross: 250000, employee: 55000, employer: 100000, net: 195000 })

  const drawn = await logged('account:account:draw')
  assert.match(drawn.form.amount.$commit, commitment)
  assert.equal((await opened(drawn.n)).amount, 300_00)

  const time = await logTime({ member: thomas, day: '2026-11-02', minutes: 90, billable: true }, as(thomas))
  assert.equal(time.state, 'settled', reason(time))
  const entry = await logged('timesheet:entry:log')
  assert.match(entry.form.minutes.$commit, commitment)
  const disclosed = async (actor: string) => {
    await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
    const { rows } = await app.query<{ o: Record<string, any> | null }>('SELECT cella.disclosed($1) AS o', [entry.n])
    await app.query(`SELECT set_config('cella.actor', '', false)`)
    return rows[0].o
  }
  assert.equal((await disclosed(thomas))?.minutes, 90, 'Thomas reads his own time back')
  assert.equal(await disclosed(sofia), null, 'Sofia reads none of it')
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})

test('the 2025 surplus is approved by m-2026-006, then distributed, and posts the legal split', async () => {
  const early = await distribute({ distribution: '2025', motion: 'm-2026-006' }, as(julien))
  assert.match(reason(early), /2025 is not approved by the assembly/)
  const wrong = await approveSplit({ distribution: '2025', motion: 'm-2026-011' }, as(julien))
  assert.equal(wrong.state, 'refused')
  assert.match(reason(wrong), /m-2026-011 does not approve 2025|m-2026-011 is not closed/)

  const approved = await approveSplit({ distribution: '2025', motion: 'm-2026-006' }, reacting(as(julien)))
  assert.equal(approved.state, 'settled', reason(approved))
  const judged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = $1', [approved.state === 'settled' && approved.entry])
  assert.deepEqual(
    [...new Set(judged.guards.map((r) => r.owner))].sort(),
    ['account-patronage', 'membership-motion', 'motion', 'motion-patronage', 'patronage', 'patronage-payslip', 'patronage-timesheet', 'patronage-transaction'],
  )

  // The distribution follows the approval as an effect in its transaction,
  // its actor Julien, who approved it, and the credits of shares follow it, which
  // the patronage scenario reads.
  const then = made('patronage:distribution:approve', approved).then
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['patronage:distribution:distribute', 'settled']])
  assert.deepEqual([...new Set(then[0].then.map((d) => `${d.op} ${d.state}`))], ['patronage:part:employ settled'])
  const done = await one<{ entry: string }>(`SELECT entry FROM patronage_transaction.distribution WHERE distribution = '2025'`)
  const posted = await lines(done.entry)
  assert.deepEqual(posted.sort((a, b) => a.account.localeCompare(b.account)), [
    { account: '1061', side: 'credit', cents: '921000' },
    { account: '1068', side: 'credit', cents: '2411178' },
    { account: '120', side: 'debit', cents: '6140000' },
    { account: '424', side: 'credit', cents: '2763000' },
    { account: '457', side: 'credit', cents: '44822' },
  ], 'the distribution\'s entry posts its split alone')
  assert.equal(await balance('120'), 0)
  const logged = await one<{ actor: string; guards: { owner: string }[] }>('SELECT actor, guards FROM cella.log WHERE n = $1', [then[0].entry])
  assert.equal(logged.actor, julien)
  assert.deepEqual(
    [...new Set(logged.guards.map((r) => r.owner))].sort(),
    ['membership-motion', 'motion', 'motion-patronage', 'patronage', 'patronage-transaction'],
  )

  const again = await distribute({ distribution: '2025', motion: 'm-2026-006' }, as(julien))
  assert.match(reason(again), /the 2025 surplus was distributed on 2026-11-02/)
  const twice = await approveSplit({ distribution: '2025', motion: 'm-2026-006' }, as(julien))
  assert.match(reason(twice), /the 2025 surplus was distributed on 2026-11-02/)

  const parts = await all<{ amount: string }>(`SELECT amount FROM patronage_payslip.work_share WHERE distribution = '2025'`)
  assert.equal(parts.length, 10)
  assert.equal(parts.reduce((s, p) => s + Number(p.amount), 0), 27_630_00, 'the work share divides by salary to the cent')
  await balanced()
})

test('a member who leaves draws nothing more, even before the freeze that follows the exit', async () => {
  // Stands in for the exit write. The freeze follows it as a write of its
  // own, account-membership's reaction, which the capital scenario runs;
  // until then a draw is refused all the same, as only a member draws.
  // Staged around the notary, it is undone after, so the log folds into
  // the state the scenario leaves.
  await su.query(`UPDATE membership.member SET status = 'exited' WHERE address = $1`, [sofia])
  try {
    assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE holder = $1`, [sofia])).frozen, false)
    const late = await draw({ member: sofia, cents: 10_00 }, as(sofia))
    assert.match(reason(late), /sofia@lanterne.example is exited: only an active member draws/)
  } finally {
    // An exit is final, so its undoing skips the trigger that says so.
    await su.query('BEGIN')
    await su.query('SET LOCAL session_replication_role = replica')
    await su.query(`UPDATE membership.member SET status = 'active' WHERE address = $1`, [sofia])
    await su.query('COMMIT')
  }
})
