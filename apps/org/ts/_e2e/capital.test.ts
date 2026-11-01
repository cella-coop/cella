// The capital scenario, end to end on a seeded Lanterne, through the
// handlers: the statutes value a share at 50 € and set how it is paid in
// and out. m-2026-012 admits Inès, and the subscription its close carries,
// signed by Camille, who closed it, calls her 20 shares, 1 000 € owed;
// she spreads it over the ten monthly instalments the statutes allow, and
// November's run, once paid, withholds the first from her pay in its own
// entry. Paul, who left in
// November 2025, is owed his 1 500 € in three yearly repayments: the
// first is refused before its day and by anyone without the power, then
// paid once on it. Malik's exit, which the assembly carries, is followed
// by the freeze and the withdrawal of his capital, each its own write
// signed by Camille; Nadia, admitted with 10 shares, stays admitted and
// is refused her subscription under the statutes' 20. The books balance
// throughout. Run by `cella test e2e capital`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close, put } from '@cella/org-graft-circle-membership-motion/api'
import { vote } from '@cella/org-motion/api'
import { accept, invite } from '@cella/org-membership/api'
import { called, pay, repay } from '@cella/org-graft-account-membership-transaction/api'
import { plan, spread, withheld } from '@cella/org-graft-account-membership-payslip-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay as payRun } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveTime, log, submit as submitTime } from '@cella/org-timesheet/api'
import type { Deps } from '@cella/org-db'
import { fixture, random, sha256, signer } from '@cella/org-sign'
import { scope, sign } from './lanterne.ts'
import { react } from '../src/lib/server/slices.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'
const nadia = 'nadia@lanterne.example'
const thomas = 'thomas@lanterne.example'
const malik = 'malik@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

// Inès signs from the laptop her hire enrolled, and Nadia from the one
// her invitation enrolls.
const as = (actor: string): Deps => ({ db: app, actor, sign: actor === ines || actor === nadia ? signer(scope, actor, fixture(actor, 'laptop')) : sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]

// The app's connection reading as `actor`, as the server reads for the
// signed-in member: what the policies let them see.
const reading = async (actor: string) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
  return app
}
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
  const c = await called(await reading(julien), paul)
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

test('m-2026-012 admits Inès, and the subscription it carries, signed by Camille who closed it, calls her 20 shares: 1 000 € owed', async () => {
  await on('2026-10-31')
  const closed = await close({ motion: 'm-2026-012' }, as(camille))
  assert.equal(closed.state, 'settled', reason(closed))
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM account_membership_transaction.subscription WHERE member = $1', [ines])).n, '0', 'the close itself subscribes nothing')
  const then = await react('motion:motion:close', { motion: 'm-2026-012' }, as(camille))
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state])]),
    [['membership:member:admit', 'settled', [['account:capital:subscribe', 'settled']]]],
  )
  const logged = await one<{ op: string; actor: string; guards: { owner: string }[] }>('SELECT op, actor, guards FROM cella.log WHERE n = $1', [then[0].then[0].entry])
  assert.deepEqual({ op: logged.op, actor: logged.actor }, { op: 'account:capital:subscribe', actor: camille })
  assert.deepEqual([...new Set(logged.guards.map((g) => g.owner))].sort(), ['account-membership-transaction', 'circle-membership-motion'])
  const s = await one<{ account: string; entry: string }>('SELECT account, entry FROM account_membership_transaction.subscription WHERE member = $1', [ines])
  assert.equal(s.account, '101312')
  assert.deepEqual(await lines(s.entry), [
    { account: '4562', side: 'debit', cents: '100000' },
    { account: '1012', side: 'credit', cents: '100000' },
  ])
  const c = await called(await reading(ines), ines)
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
  const mine = await plan(await reading(ines), ines, ines)
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
  const c = await called(await reading(julien), paul)
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

  const c = await called(await reading(ines), ines)
  assert.deepEqual({ paid: c.paid, unpaid: c.unpaid, via: c.payments.map((p) => p.via) }, { paid: 100_00, unpaid: 900_00, via: ['pay'] })
  assert.equal(await balance('101312'), -100_00, 'her account holds what she paid in')
  const slip = await withheld(await reading(ines), `2026-11~${ines}`)
  assert.deepEqual({ amount: slip?.amount, entry: slip?.entry }, { amount: 100_00, entry })
  assert.equal((await plan(await reading(ines), ines, ines)).withheld.length, 1)
  await balanced()
})

// A motion of the assembly asking `kind` of `args`, put on `from`: every
// active member on its roll consents, it closes on `until`, and what its
// close carries follows it, signed by Camille, who closes it.
async function decided(kind: 'admit' | 'exit', args: Record<string, string | number>, from: string, until: string) {
  await on(from)
  const proposed = settled(await put({ kind, args, deadline: until, body: '' }, as(camille))) as { motion: string }
  const roll = await all<{ member: string }>(
    `SELECT r.member FROM circle_membership_motion.roll r JOIN membership.member m ON m.address = r.member
     WHERE r.motion = $1 AND m.status = 'active'`,
    [proposed.motion],
  )
  for (const { member } of roll) {
    settled(await vote({ motion: proposed.motion, member, stance: 'consent' }, as(member)))
  }
  await on(until)
  settled(await close({ motion: proposed.motion }, as(camille)))
  return react('motion:motion:close', { motion: proposed.motion }, as(camille))
}

test('an exit the assembly carries is followed by the freeze and the withdrawal of the capital, each its own write signed by Camille', async () => {
  const before = await balance('101308')
  assert.ok(before < 0, 'Malik\'s account holds his capital')
  const then = await decided('exit', { member: malik }, '2026-12-01', '2026-12-08')
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state])]),
    [['membership:member:exit', 'settled', [['account:account:freeze', 'settled'], ['account:capital:withdraw', 'settled']]]],
  )
  for (const t of then[0].then) {
    assert.equal((await one<{ actor: string }>('SELECT actor FROM cella.log WHERE n = $1', [t.entry])).actor, camille)
  }
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE code = '101308'`)).frozen, true)
  assert.equal(await balance('101308'), 0, 'what it held moved to 4567')
  const c = await called(await reading(julien), malik)
  assert.deepEqual({ owed: c.owed, repayments: c.repayments.map((r) => [r.n, r.due]) }, {
    owed: -before,
    repayments: [
      [1, '2027-12-08'],
      [2, '2028-12-08'],
      [3, '2029-12-08'],
    ],
  })
  await balanced()
})

test('an admission whose subscription its guard refuses stays an admission: Nadia, admitted with 10 shares, is refused her subscription under the statutes\' 20', async () => {
  await on('2026-12-08')
  const secret = random()
  settled(await invite({ address: nadia, name: 'Nadia Benali', link: await sha256(secret) }, as(thomas)))
  settled(await accept({ member: nadia, secret, key: (await fixture(nadia, 'laptop')).key, label: 'laptop' }, as(nadia)))
  const then = await decided('admit', { member: nadia, shares: 10 }, '2026-12-08', '2026-12-15')
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['membership:member:admit', 'settled']])
  const refused = then[0].then[0]
  assert.equal(refused.op, 'account:capital:subscribe')
  assert.equal(refused.state, 'refused')
  assert.match(refused.reason ?? '', /nadia@lanterne.example subscribes 10 shares: st-2021 ask at least 20/)
  assert.equal((await one<{ status: string }>('SELECT status FROM membership.member WHERE address = $1', [nadia])).status, 'active')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM account.account WHERE holder = $1', [nadia])).n, '0', 'and holds no capital account')
  await balanced()
})
