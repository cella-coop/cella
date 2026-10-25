// The capital scenario, end to end on a seeded Lanterne, through the
// handlers: the statutes value a share at 50 € and set how it is paid in
// and out. d-2026-012 admits Inès, and in that verdict her 20 shares are
// called, 1 000 € owed on her subscription; she spreads it over the ten
// monthly instalments the statutes allow, and November's run, once paid,
// withholds the first from her pay in its own entry. Paul, who left in
// November 2025, is owed his 1 500 € in three yearly repayments: the
// first is refused before its day and by anyone without the power, then
// paid once on it. The books balance throughout. Run by `cella test e2e
// capital`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close } from '@cella/org-graft-circle-decision-member/api'
import { called, pay, repay } from '@cella/org-graft-account-member-transaction/api'
import { plan, spread, withheld } from '@cella/org-graft-account-member-payslip-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay as payRun } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveTime, log, submit as submitTime } from '@cella/org-timesheet/api'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { scope, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

// Inès signs from the laptop her hire enrolled.
const as = (actor: string): Deps => ({ db: app, actor, sign: actor === ines ? signer(scope, ines, fixture(ines, 'laptop')) : sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const balance = async (code: string) => Number((await one<{ b: string }>('SELECT balance AS b FROM account_transaction.balance WHERE code = $1', [code]))?.b ?? 0)
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

test('the statutes value a share at 50 €, and Paul, who left, is owed his 1 500 € in three yearly repayments', async () => {
  const t = await one<{ terms: string; share: string; minimum: number; instalments: number; delay: number; repayments: number }>(
    `SELECT t.id AS terms, cella.cents(t.share) AS share, t.minimum, t.instalments, t.delay, t.repayments
     FROM account.terms t WHERE t.id = account.capital_for(cella.verdict_date())`,
  )
  assert.deepEqual(t, { terms: 'st-2021', share: '5000', minimum: 20, instalments: 10, delay: 12, repayments: 3 })
  const c = await called(app, paul)
  assert.deepEqual(
    c.repayments.map((r) => [r.n, r.due, r.amount, r.paid]),
    [
      [1, '2026-11-30', 500_00, null],
      [2, '2027-11-30', 500_00, null],
      [3, '2028-11-30', 500_00, null],
    ],
  )
  assert.deepEqual({ owed: c.owed, left: c.left, next: c.next }, { owed: 1_500_00, left: 1_500_00, next: 1 })
  assert.equal(await balance('101311'), 0)
  assert.equal(await balance('4567'), -1_500_00)
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE code = '101311'`)).frozen, true)
  await balanced()
})

test('d-2026-012 admits Inès, and in that verdict her 20 shares are called: 1 000 € owed on her subscription', async () => {
  await on('2026-10-31')
  settled(await close({ decision: 'd-2026-012' }, as(camille)))
  const s = await one<{ account: string; entry: string }>('SELECT account, entry FROM account_member_transaction.subscription WHERE member = $1', [ines])
  assert.equal(s.account, '101312')
  assert.deepEqual(await lines(s.entry), [
    { account: '4562', side: 'debit', cents: '100000' },
    { account: '1012', side: 'credit', cents: '100000' },
  ])
  const c = await called(app, ines)
  assert.deepEqual({ subscribed: c.subscribed, paid: c.paid, unpaid: c.unpaid }, { subscribed: 1_000_00, paid: 0, unpaid: 1_000_00 })
  assert.equal(await balance('101312'), 0, 'her account holds what she pays in, nothing yet')
  await balanced()
})

test('she spreads it over the statutes\' ten instalments from her pay; more is refused, and no one spreads it but her', async () => {
  const more = await spread({ member: ines, instalments: 12 }, as(ines))
  assert.match(reason(more), /spreads their subscription over 12 instalments: st-2021 allow at most 10/)
  const forHer = await spread({ member: ines, instalments: 10 }, as(camille))
  assert.match(reason(forHer), /camille@lanterne.example may spread only their own subscription/)
  const p = settled(await spread({ member: ines, instalments: 10 }, as(ines)))
  assert.equal(p.each, 100_00)
  const mine = await plan(app, ines, ines)
  assert.deepEqual({ instalments: mine.instalments, each: mine.each, since: mine.since, own: mine.own }, { instalments: 10, each: 100_00, since: '2026-10-31', own: true })
})

test('a payment in beyond what she owes is refused, as is one on no subscription', async () => {
  const beyond = await pay({ member: ines, cents: 1_200_00 }, as(julien))
  assert.match(reason(beyond), /a payment of 120000 cents exceeds what ines@lanterne.example owes on their subscription, 100000 cents/)
  const none = await pay({ member: hugo, cents: 100_00 }, as(julien))
  assert.match(reason(none), /hugo@lanterne.example has no subscription to pay/)
})

test('Paul\'s first repayment is refused the day before it falls due and by the gérante, then paid on its day, once', async () => {
  await on('2026-11-29')
  const early = await repay({ member: paul, n: 1 }, as(julien))
  assert.match(reason(early), /paul@lanterne.example's repayment 1 falls due on 2026-11-30/)
  await on('2026-11-30')
  const byCamille = await repay({ member: paul, n: 1 }, as(camille))
  assert.match(reason(byCamille), /holds no mandate for repay-capital/)
  const bank = await balance('512')
  const r = settled(await repay({ member: paul, n: 1 }, as(julien)))
  assert.deepEqual(await lines(r.entry ?? ''), [
    { account: '4567', side: 'debit', cents: '50000' },
    { account: '512', side: 'credit', cents: '50000' },
  ])
  assert.equal(await balance('512'), bank - 500_00)
  assert.equal(await balance('4567'), -1_000_00)
  const twice = await repay({ member: paul, n: 1 }, as(julien))
  assert.match(reason(twice), /paul@lanterne.example's repayment 1 was paid on 2026-11-30/)
  const c = await called(app, paul)
  assert.deepEqual({ repaid: c.repaid, left: c.left, next: c.next }, { repaid: 500_00, left: 1_000_00, next: 2 })
  await balanced()
})

test('November\'s run pays Inès, a member now, and its payment withholds her first instalment in its own entry', async () => {
  await on('2026-12-01')
  const salaried = (await all<{ member: string }>(`SELECT DISTINCT member FROM payslip.salary WHERE "from" <= '2026-11-01' ORDER BY member`)).map((r) => r.member)
  assert.equal(salaried.length, 11)
  for (const m of salaried) {
    // A day of November logged, so each month has time in it.
    settled(await log({ member: m, day: '2026-11-30', minutes: 420, billable: false }, as(m)))
    settled(await submitTime({ member: m, month: '2026-11' }, as(m)))
    settled(await approveTime({ member: m, month: '2026-11' }, as(m === camille ? hugo : camille)))
  }
  const run = settled(await generate({ month: '2026-11' }, as(julien)))
  assert.equal(run.payslips, 11)
  settled(await approveRun({ month: '2026-11' }, as(camille)))
  const bank = await balance('512')
  const paid = settled(await payRun({ month: '2026-11' }, as(julien)))
  const entry = paid.entry ?? ''
  const posted = await lines(entry)
  assert.deepEqual(posted.slice(-4), [
    { account: '512', side: 'debit', cents: '10000' },
    { account: '4562', side: 'credit', cents: '10000' },
    { account: '1012', side: 'debit', cents: '10000' },
    { account: '101312', side: 'credit', cents: '10000' },
  ])
  const due = await one<{ net: string; charges: string }>(
    `SELECT sum(cella.cents(net)) AS net, sum(cella.cents(employee) + cella.cents(employer)) AS charges FROM payslip.payslip WHERE month = '2026-11'`,
  )
  assert.equal(await balance('512'), bank - Number(due.net) - Number(due.charges) + 100_00, 'the bank pays her less by the instalment')
  assert.equal(await balance('421'), 0, 'her pay is settled whole')

  const c = await called(app, ines)
  assert.deepEqual({ paid: c.paid, unpaid: c.unpaid, via: c.payments.map((p) => p.via) }, { paid: 100_00, unpaid: 900_00, via: ['pay'] })
  assert.equal(await balance('101312'), -100_00, 'her account holds what she paid in')
  const slip = await withheld(app, `2026-11~${ines}`)
  assert.deepEqual({ amount: slip?.amount, entry: slip?.entry }, { amount: 100_00, entry })
  assert.equal((await plan(app, ines, ines)).withheld.length, 1)
  await balanced()
})
