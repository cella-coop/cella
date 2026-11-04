// The capital scenario, end to end on a seeded Lanterne, through the
// handlers: the statutes value a share at 50 € and set how it is paid in
// and out. m-2026-012 admits Inès, and the subscription its close carries,
// signed by Camille, who closed it, calls her 20 shares, 1 000 € owed;
// she spreads it over the ten monthly instalments the statutes allow, and
// November's run, once paid, withholds the first from her pay in its own
// entry. Paul, who left in
// November 2025, is owed his 1 500 € in three yearly repayments: the
// first is refused before its day and by anyone without the power, then
// paid once on it. Malik's exclusion, which the assembly carries, is followed
// by the freeze and the withdrawal of his capital, each its own write
// signed by Camille. Amina withdraws by her own right, and her own freeze
// and withdrawal of her capital follow, signed by her; no one withdraws
// another, nor excludes a member without the assembly's motion. The
// assembly then adopts new capital terms, a rule of
// at least ten shares at 25 € replacing the founding one, whose values are
// copied into the terms by the write that follows the adoption; a rule
// whose value says no way is stricter is refused when proposed. Nadia,
// admitted with 8 shares, stays admitted and is refused her subscription
// with the rule's sentence. The statutes, the assembly's policies in
// order, are generated anew once the new terms are adopted, their sentence
// where the founding one read, and adopted under the same motion; the
// version before still reads, and no hand edits them. The books balance
// throughout. Run by `cella test e2e capital`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close, propose, put } from '@cella/org-graft-membership-motion/api'
import { vote } from '@cella/org-motion/api'
import { accept, exclude, invite, withdraw } from '@cella/org-membership/api'
import { called, pay, repay } from '@cella/org-graft-account-membership-transaction/api'
import { plan, spread, withheld } from '@cella/org-graft-account-membership-payslip-transaction/api'
import { generate } from '@cella/org-graft-payslip-timesheet/api'
import { approve as approveRun, pay as payRun } from '@cella/org-graft-payslip-transaction/api'
import { approve as approveTime, log, submit as submitTime } from '@cella/org-timesheet/api'
import { adopt, edit, merged, version } from '@cella/org-document/api'
import { createDoc, edits, hash, order } from '@cella/org-document/models'
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
const amina = 'amina@lanterne.example'
// The capital's terms the founding assembly adopted, as the rule
// m-2021-001/43.
const founded = 'm-2021-001-43'
// Its rule, and the rule of the terms the assembly adopts in December.
const founding = 'm-2021-001/43'
let newTerms = ''
let termsMotion = ''
let generatedAt = 0

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
  assert.deepEqual(t, { terms: founded, share: '5000', minimum: 20, instalments: 10, delay: 12, repayments: 3 })
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
  assert.deepEqual([...new Set(logged.guards.map((g) => g.owner))].sort(), ['account-membership-transaction', 'membership-motion', 'motion'])
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
  assert.match(reason(more), /spreads their subscription over 12 instalments: "A share is worth 50 €. .*may pay them in at most 10 monthly instalments./)
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
    // Logged naming no circle, each month is the root's, which Julien's
    // approve-time, as treasurer on the whole co-op, covers.
    settled(await approveTime({ member: m, month: '2026-11' }, as(m === julien ? camille : julien)))
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
async function decided(kind: 'admit' | 'exclude', args: Record<string, string | number>, from: string, until: string) {
  await on(from)
  const proposed = settled(await put({ kind, args, deadline: until, body: '' }, as(camille))) as { motion: string }
  const roll = await all<{ member: string }>(
    `SELECT r.member FROM membership_motion.roll r JOIN membership.member m ON m.address = r.member
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

test('an exclusion the assembly carries is followed by the freeze and the withdrawal of the capital, each its own write signed by Camille', async () => {
  const before = await balance('101308')
  assert.ok(before < 0, 'Malik\'s account holds his capital')
  const then = await decided('exclude', { member: malik }, '2026-12-01', '2026-12-08')
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state])]),
    [['membership:member:exclude', 'settled', [['account:account:freeze', 'settled'], ['account:capital:withdraw', 'settled']]]],
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

test('Amina withdraws by her own right, followed by her own freeze and withdrawal of her capital, each signed by her; no one withdraws another, nor excludes without the assembly\'s motion', async () => {
  await on('2026-12-09')
  assert.match(reason(await withdraw({ member: amina }, as(julien))), /julien@lanterne\.example may not withdraw amina@lanterne\.example's membership: only their own/)
  assert.match(reason(await exclude({ member: amina, motion: 'm-2026-999' }, as(camille))), /no motion m-2026-999/)
  assert.equal((await one<{ status: string }>('SELECT status FROM membership.member WHERE address = $1', [amina])).status, 'active')
  const before = await balance('101309')
  assert.ok(before < 0, 'Amina\'s account holds her capital')
  const left = await withdraw({ member: amina }, as(amina))
  settled(left)
  assert.equal((await one<{ cites: boolean }>(`SELECT form ? 'motion' AS cites FROM cella.log WHERE n = $1`, [(left as { entry: number }).entry])).cites, false, 'a withdrawal cites no motion')
  const then = await react('membership:member:withdraw', { member: amina }, as(amina))
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['account:own:freeze', 'settled'], ['account:own:withdraw', 'settled']])
  for (const t of then) {
    assert.equal((await one<{ actor: string }>('SELECT actor FROM cella.log WHERE n = $1', [t.entry])).actor, amina)
  }
  assert.equal((await one<{ frozen: boolean }>(`SELECT frozen FROM account.account WHERE code = '101309'`)).frozen, true)
  assert.equal(await balance('101309'), 0, 'what it held moved to 4567')
  const c = await called(await reading(julien), amina)
  assert.deepEqual({ owed: c.owed, repayments: c.repayments.map((r) => [r.n, r.due]) }, {
    owed: -before,
    repayments: [
      [1, '2027-12-09'],
      [2, '2028-12-09'],
      [3, '2029-12-09'],
    ],
  })
  // Gone, she withdraws no more.
  await assert.rejects(withdraw({ member: amina }, as(amina)), /amina@lanterne\.example is no member, or is exited already/)
  await balanced()
})

test('the assembly adopts capital terms of at least ten shares at 25 €, a rule replacing the founding one; a value that says no way is stricter is refused', async () => {
  const wording = (minimum: string) =>
    `A share is worth {account_share: 25 € | more is stricter}. Each associate subscribes at least {account_minimum: ${minimum}} shares, ` +
    'and may pay them in at most {account_instalments: 10 | less is stricter} monthly instalments. An associate who leaves is repaid their shares ' +
    'at their nominal value from {account_delay: 12 | more is stricter} months after the exit, in {account_repayments: 3 | more is stricter} yearly repayments'
  const rule = (args: Record<string, string>) =>
    propose(
      { circle: 'ag', title: 'Adopt new capital terms', procedure: 'consent', deadline: '2026-12-15', body: '', actions: [{ kind: 'policy', args: { kind: 'rule', ...args } }] },
      as(camille),
    )
  await on('2026-12-08')
  const undirected = await rule({ wording: wording('10'), replaces: founding })
  assert.match(reason(undirected), /account_minimum is 10: a rule's value says which way is stricter, as \{account_minimum: 10 \| more is stricter\}/)
  const unplaced = await rule({ wording: wording('10 | more is stricter') })
  assert.match(reason(unplaced), new RegExp(`the capital's terms replace those that govern, ${founding}`))

  const motion = settled(await rule({ wording: wording('10 | more is stricter'), replaces: founding })).motion
  const roll = await all<{ member: string }>(
    `SELECT r.member FROM membership_motion.roll r JOIN membership.member m ON m.address = r.member
     WHERE r.motion = $1 AND m.status = 'active'`,
    [motion],
  )
  for (const { member } of roll) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-12-15')
  settled(await close({ motion }, as(camille)))
  const then = await react('motion:motion:close', { motion }, as(camille))
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state])]),
    [['motion:policy:adopt', 'settled', [['document:document:generate', 'settled'], ['account:terms:adopt', 'settled']]]],
  )
  const t = await one<{ policy: string; share: string; minimum: number; from: string }>(
    `SELECT t.policy, cella.cents(t.share) AS share, t.minimum, to_char(t."from", 'YYYY-MM-DD') AS "from"
     FROM account.terms t WHERE t.policy = $1`,
    [`${motion}/1`],
  )
  assert.equal((await one<{ t: string }>(`SELECT account.capital_for('2026-12-15') AS t`)).t, `${motion}-1`, 'they govern from the day the rule applies')
  assert.deepEqual({ share: t.share, minimum: t.minimum, from: t.from }, { share: '2500', minimum: 10, from: '2026-12-15' })
  assert.equal((await one<{ ends: string }>(`SELECT to_char(ends, 'YYYY-MM-DD') AS ends FROM policy.policy WHERE id = $1`, [founding])).ends, '2026-12-15')
  assert.equal(
    (await one<{ s: string }>('SELECT policy.sentence(w.legal) AS s FROM policy.wording w WHERE w.policy = $1', [t.policy])).s,
    'A share is worth 25 €. Each associate subscribes at least 10 shares, and may pay them in at most 10 monthly instalments. An associate who leaves is repaid their shares at their nominal value from 12 months after the exit, in 3 yearly repayments',
  )
  newTerms = t.policy
  termsMotion = motion
  generatedAt = then[0].then[0].entry ?? 0
})

// A version's lines, as the database reads its text.
const linesOf = async (v: string) => (await one<{ plain: string }>('SELECT plain FROM document.version WHERE id = $1', [v])).plain.split('\n')

test('the statutes are generated anew with the new terms where the founding ones read, adopted under the same motion, and the version before still reads', async () => {
  const founding = (await one<{ s: string }>(`SELECT policy.says('m-2021-001/43') AS s`)).s
  const adopted = (await one<{ s: string }>('SELECT policy.says($1) AS s', [newTerms])).s
  assert.equal((await one<{ version: string }>(`SELECT version FROM document.adopted WHERE document = 'statutes'`)).version, 'statutes@3')
  const before = await linesOf('statutes@2')
  const after = await linesOf('statutes@3')
  assert.ok(before.includes(founding), 'statutes@2 reads the founding terms')
  assert.ok(!after.includes(founding), 'statutes@3 no longer does')
  assert.equal(after.indexOf(adopted), before.indexOf(founding), 'the new terms read where the founding ones did')
  assert.equal(after.length, before.length)

  // Its entry commits to the version's hash, which the snapshot computes
  // again, in the database and out of it.
  const logged = await one<{ op: string; form: Record<string, unknown> }>('SELECT op, form FROM cella.log WHERE n = $1', [generatedAt])
  assert.equal(logged.op, 'document:document:generate')
  assert.deepEqual([logged.form.version, logged.form.base, logged.form.motion, logged.form.day], ['statutes@3', 'statutes@2', termsMotion, '2026-12-15'])
  const v = await one<{ hash: string; again: string; snapshot: Buffer }>(
    `SELECT encode(hash, 'hex') AS hash, encode(cella.document_hash(snapshot), 'hex') AS again, snapshot FROM document.version WHERE id = 'statutes@3'`,
  )
  assert.equal(logged.form.hash, v.hash)
  assert.equal(v.again, v.hash)
  const doc = createDoc()
  doc.import(new Uint8Array(v.snapshot))
  assert.equal(hash(doc), v.hash, 'anyone holding the version computes its hash')
  const guards = await one<{ owners: string[] }>(`SELECT array(SELECT g ->> 'owner' FROM jsonb_array_elements(guards) g ORDER BY 1) AS owners FROM cella.log WHERE n = $1`, [generatedAt])
  assert.deepEqual(guards.owners, ['document', 'document', 'membership-motion', 'motion'])

  const earlier = await one<{ hash: string; again: string }>(
    `SELECT encode(hash, 'hex') AS hash, encode(cella.document_hash(snapshot), 'hex') AS again FROM document.version WHERE id = 'statutes@2'`,
  )
  assert.equal(earlier.again, earlier.hash, 'statutes@2 still reads as it was adopted')
})

test('no hand edits the statutes, saves a version of them or adopts one', async () => {
  const draft = await merged(app, 'statutes')
  const from = draft.version()
  const last = order(draft).at(-1)
  assert.ok(last)
  edits.after(draft, last.id, 'paragraph', {}, [{ text: 'The gérante may sign alone.' }])
  draft.commit()
  const generated = /statutes is generated from the policies of ag: it changes only as they do/
  assert.match(reason(await edit({ document: 'statutes', update: draft.export({ mode: 'update', from }) }, as(camille))), generated)
  assert.match(reason(await version({ document: 'statutes' }, as(camille))), generated)
  const adopting = await adopt({ document: 'statutes', version: 'statutes@2', base: 'statutes@3', motion: termsMotion }, as(camille))
  assert.equal(adopting.state, 'refused')
  assert.equal((await one<{ version: string }>(`SELECT version FROM document.adopted WHERE document = 'statutes'`)).version, 'statutes@3')
})

test('an admission whose subscription its guard refuses stays an admission: Nadia, admitted with 8 shares, is refused her subscription with the rule\'s sentence', async () => {
  await on('2026-12-15')
  const secret = random()
  settled(await invite({ address: nadia, name: 'Nadia Benali', link: await sha256(secret) }, as(thomas)))
  settled(await accept({ member: nadia, secret, key: (await fixture(nadia, 'laptop')).key, label: 'laptop' }, as(nadia)))
  const then = await decided('admit', { member: nadia, shares: 8 }, '2026-12-15', '2026-12-22')
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['membership:member:admit', 'settled']])
  const refused = then[0].then[0]
  assert.equal(refused.op, 'account:capital:subscribe')
  assert.equal(refused.state, 'refused')
  assert.equal(
    refused.reason,
    'nadia@lanterne.example subscribes 8 shares: "' +
      (await one<{ s: string }>('SELECT policy.says($1) AS s', [newTerms])).s +
      '"',
  )
  assert.match(refused.reason ?? '', /Each associate subscribes at least 10 shares/)
  assert.equal((await one<{ status: string }>('SELECT status FROM membership.member WHERE address = $1', [nadia])).status, 'active')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM account.account WHERE holder = $1', [nadia])).n, '0', 'and holds no capital account')
  await balanced()
})
