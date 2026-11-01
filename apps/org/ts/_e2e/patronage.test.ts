// The patronage scenario, end to end on a seeded Lanterne, through the
// handlers and the reactions the shell runs: the 2025 distribution is
// approved by m-2026-006, and in that one write its work share divides
// among the ten members by what each was paid in 2025, as the statutes'
// terms say; the distribution follows the approval, and the credit of
// each associate's shares the distribution, each a write of its own
// signed by Camille, who approved it: half of each part buys whole
// shares, blocked five years, and the rest is owed in cash. The parts,
// the shares, the cash and the books reconcile to the cent; each member
// reads their own statement, and finance the year's return. Then the
// assembly adopts a rule of new terms, a mix of pay and time from 2027,
// replacing the founding one; a rule dividing less than the whole, or with
// a value that says no way is stricter, is refused when proposed, and the
// values are copied into the terms citing that motion, once. Last, the second year runs
// with no fixture SQL: finance opens 2027's first month and closes
// 2026's, drafts the 2026 split, the assembly moves to approve it, and
// once it is approved its distribution and credits follow, signed by the
// member who closed the motion and approved it.
// Run by `cella test e2e patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { adopt, approve, draft, statement, statements } from '@cella/org-patronage/api'
import { close as closePeriod, open } from '@cella/org-account/api'
import { distribute } from '@cella/org-graft-patronage-transaction/api'
import { react } from '../src/lib/server/slices.ts'
import { federation } from '@cella/org-report/api'
import { reading as analytics } from './port.ts'
import { employ, employed, figures, owed } from '@cella/org-graft-account-membership-patronage-transaction/api'
import { vote } from '@cella/org-motion/api'
import { close, propose } from '@cella/org-graft-circle-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const hugo = 'hugo@lanterne.example'
const chloe = 'chloe@lanterne.example'
const share = 50_00
// The work share's terms the founding assembly adopted, as the rule
// m-2021-001/44.
const founded = 'm-2021-001-44'

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
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const balance = async (code: string) => Number((await one<{ b: string }>('SELECT balance AS b FROM account_transaction.balance WHERE code = $1', [code])).b)
const balanced = async () => {
  const t = await one<{ debit: string; credit: string }>('SELECT sum(debit) AS debit, sum(credit) AS credit FROM account_transaction.balance')
  assert.equal(t.debit, t.credit, 'the trial balance agrees')
}

type Part = { worker: string; quantity: string; cents: string }
let parts: Part[] = []
let before2025: Map<string, { shares: number; capital: number }>
let capital2025 = 0

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('before the approval, no statement is drawn, and the work share would divide by 2025 pay', async () => {
  assert.deepEqual(await statements(await reading(julien)), [])
  const preview = await all<{ amount: string }>(`SELECT amount FROM patronage_payslip.work_share WHERE distribution = '2025'`)
  assert.equal(preview.length, 10)
  assert.equal(preview.reduce((s, p) => s + Number(p.amount), 0), 27_630_00)
  const terms = await one<{ terms: string; basis: string }>(`SELECT patronage.terms_for(2025) AS terms, patronage.basis_of(patronage.terms_for(2025)) AS basis`)
  assert.deepEqual(terms, { terms: founded, basis: 'salary' })
  before2025 = new Map(
    (await all<{ member: string; shares: number; b: string }>(
      `SELECT c.member, c.shares, coalesce((SELECT -b.balance FROM account_transaction.balance b WHERE b.code = c.account), 0) AS b
       FROM account_membership.capital c WHERE c.account IS NOT NULL`,
    )).map((r) => [r.member, { shares: r.shares, capital: Number(r.b) }]),
  )
})

test('approving 2025 divides the work share by pay, to the cent, in the same write, and is not yet distributed', async () => {
  await on('2026-11-02')
  const done = await approve({ distribution: '2025', motion: 'm-2026-006' }, as(camille))
  settled(done)

  parts = await all<Part>(
    `SELECT worker, quantity, cella.cents(amount) AS cents FROM patronage.part WHERE distribution = '2025' AND basis = 'salary' ORDER BY worker`,
  )
  assert.equal(parts.length, 10)
  assert.equal(parts.reduce((s, p) => s + Number(p.cents), 0), 27_630_00, 'the parts add up to the work share')
  const paid = parts.reduce((s, p) => s + Number(p.quantity), 0)
  assert.equal(paid, 26_000_00 * 12, 'ten salaries for twelve months')
  for (const p of parts) {
    const exact = (27_630_00 * Number(p.quantity)) / paid
    assert.ok(Math.abs(Number(p.cents) - exact) < 1, `${p.worker}'s part is their pay's share of the work share`)
  }
  const camilles = parts.find((p) => p.worker === camille)
  assert.equal(camilles?.quantity, String(3_000_00 * 12))
  assert.deepEqual(await one(`SELECT count(*)::int AS n FROM patronage.part WHERE distribution = '2025' AND basis <> 'salary'`), { n: 0 })

  assert.equal(await employed(await reading(julien), `2025:${camille}`), null, 'nothing is credited before the distribution')
  assert.deepEqual(await figures(await reading(julien), '2025'), [], 'the return waits for the distribution')
  assert.equal(await balance('120'), -61_400_00, 'the result still waits in 120')
})

test('the distribution and the credits of shares follow the approval, each a write of its own signed by Camille, who approved it', async () => {
  assert.deepEqual(await all(`SELECT tgname FROM pg_trigger WHERE tgname = 'employs'`), [], 'no trigger credits a distribution')
  const then = await react('patronage:distribution:approve', { distribution: '2025', motion: 'm-2026-006' }, as(camille))
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['patronage:distribution:distribute', 'settled']])
  const credits = then[0].then
  assert.equal(credits.length, 10, 'one credit an associate')
  for (const c of credits) {
    assert.equal(`${c.op} ${c.state}`, 'patronage:part:employ settled', c.reason)
  }
  const logged = await all<{ op: string; actor: string; owners: string[] }>(
    `SELECT op, actor, ARRAY(SELECT DISTINCT g ->> 'owner' FROM jsonb_array_elements(guards) g ORDER BY 1) AS owners
     FROM cella.log WHERE n = ANY($1::bigint[]) ORDER BY n`,
    [[then[0].entry, ...credits.map((c) => c.entry)]],
  )
  assert.deepEqual(logged[0], { op: 'patronage:distribution:distribute', actor: camille, owners: ['circle-membership-motion', 'circle-motion', 'motion-patronage', 'patronage', 'patronage-transaction'] })
  for (const l of logged.slice(1)) {
    assert.deepEqual(l, { op: 'patronage:part:employ', actor: camille, owners: ['account-membership-patronage-transaction', 'circle-membership-motion', 'circle-motion', 'motion-patronage', 'patronage'] })
  }
  const entry = (await one<{ entry: string }>(`SELECT entry FROM patronage_transaction.distribution WHERE distribution = '2025'`)).entry
  assert.deepEqual((await all(`SELECT account FROM transaction.line WHERE entry = $1 ORDER BY n`, [entry])).length, 5, 'the distribution\'s entry posts its split alone')
})

test('what follows the approval is done once, and nothing writes a credit or a member\'s shares outside a write', async () => {
  const again = await distribute({ distribution: '2025', motion: 'm-2026-006' }, as(julien))
  assert.match(reason(again), /the 2025 surplus was distributed on 2026-11-02/)
  await assert.rejects(employ({ distribution: '2025', member: camille, motion: 'm-2026-006' }, as(camille)), /camille@lanterne.example was credited the shares of their part of 2025 already/)
  for (const [db, sql] of [
    [app, `INSERT INTO account_membership_patronage_transaction.credit (distribution, member, account, shares, amount, until, entry) VALUES ('1999', '${hugo}', '101301', 1, cella.amount(5000), '2031-06-01', 'je-x')`],
    [su, `UPDATE membership.member SET shares = shares + 1 WHERE address = '${hugo}'`],
  ] as const) {
    await assert.rejects(db.query(sql), /is written outside a write/)
  }
})

test('half of each part buys whole shares at 50 €, blocked until 1 June 2031; the rest is owed in cash', async () => {
  const credits = await all<{ member: string; shares: number; cents: string; until: string; entry: string }>(
    `SELECT member, shares, cella.cents(amount) AS cents, to_char(until, 'YYYY-MM-DD') AS until, entry
     FROM account_membership_patronage_transaction.credit WHERE distribution = '2025' ORDER BY member`,
  )
  assert.equal(credits.length, 10, 'every worker is an associate')
  let capital = 0
  for (const p of parts) {
    const c = credits.find((x) => x.member === p.worker)
    const shares = Math.floor((Number(p.cents) * 0.5) / share)
    assert.equal(c?.shares, shares, `${p.worker} buys ${shares} shares`)
    assert.equal(Number(c?.cents), shares * share)
    assert.equal(c?.until, '2031-06-01')
    capital += shares * share
  }
  assert.equal(new Set(credits.map((c) => c.entry)).size, 10, 'each credit posts an entry of its own')
  capital2025 = capital

  const cash = 27_630_00 - capital
  assert.equal(await balance('424'), -cash, '424 still owes what is paid in cash')
  for (const c of credits) {
    const was = before2025.get(c.member)
    const now = await one<{ shares: number; b: string }>(
      `SELECT c.shares, -b.balance AS b FROM account_membership.capital c JOIN account_transaction.balance b ON b.code = c.account WHERE c.member = $1`,
      [c.member],
    )
    assert.equal(now.shares, (was?.shares ?? 0) + c.shares, `${c.member} holds the shares`)
    assert.equal(Number(now.b), (was?.capital ?? 0) + Number(c.cents), `${c.member}'s capital account holds them`)
    assert.equal(Number(now.b), now.shares * share, 'a capital account still holds its member\'s shares at their value')
  }
  assert.equal(await balance('120'), 0)
  await balanced()
})

test('each member reads their statement, which reconciles with the books; their page shows it to them alone', async () => {
  const listed = await statements(await reading(julien))
  assert.equal(listed.length, 10, 'whoever distributes the surplus reads every statement')
  assert.equal(listed.reduce((s, x) => s + x.amount, 0), 27_630_00)
  assert.deepEqual((await statements(await reading(chloe))).map((s) => s.worker), [chloe], 'a worker reads their own alone')
  assert.equal(await statement(app, `2025:${camille}`), null, 'and not a colleague\'s')

  const id = `2025:${camille}`
  const sheet = await statement(await reading(camille), id)
  const part = Number(parts.find((p) => p.worker === camille)?.cents)
  assert.equal(sheet?.amount, part)
  assert.deepEqual(sheet?.lines.map((l) => [l.basis, l.weight, l.portion, l.amount]), [['salary', 100, 27_630_00, part]])
  assert.equal(sheet?.terms?.id, founded)

  const became = await employed(app, id)
  assert.equal((became?.capital ?? 0) + (became?.cash ?? 0), part)
  assert.equal(became?.movements.at(-1)?.balance, (await one<{ shares: number }>('SELECT shares FROM membership.member WHERE address = $1', [camille])).shares * share)
  assert.equal(became?.movements.at(-1)?.amount, became?.capital)

  assert.deepEqual((await owed(app, camille, camille)).map((s) => [s.id, s.part, s.capital + s.cash, s.capital, s.distributed]), [[id, part, part, became?.capital, true]])
  assert.deepEqual(await owed(await reading(julien), camille, julien), [])
})

test('the year\'s return to the federation reconciles with the split, the parts and the shares', async () => {
  // The return is the co-op's: Chloé, who reads no colleague's part, reads it whole.
  const f = Object.fromEntries((await figures(await reading(chloe), '2025')).map((x) => [x.id, x.value]))
  assert.equal(f.surplus, 61_400_00)
  assert.equal(f.work, 27_630_00)
  assert.equal(Number(f.legal) + Number(f.development) + Number(f.work) + Number(f.interest), 61_400_00)
  assert.equal(f.workers, 10)
  assert.equal(f.associates_sharing, 10)
  const employedCents = (await one<{ c: string }>(`SELECT sum(cella.cents(amount)) AS c FROM account_membership_patronage_transaction.credit WHERE distribution = '2025'`)).c
  assert.equal(f.employed, Number(employedCents))
  assert.equal(Number(f.employed) + Number(f.cash), 27_630_00)
  assert.equal(f.until, '2031-06-01')
  assert.equal(f.reserve, 9_000_00 + 9_210_00, 'the legal reserve after the distribution')
  assert.equal(f.employee_capital, 100)
})

test('the report feat\'s federation figures, read through the analytics shell, are the return\'s, and its entry posts each share', async () => {
  const f = Object.fromEntries((await figures(await reading(chloe), '2025')).map((x) => [x.id, Number(x.value) || x.value]))
  const shell = await analytics(su, '54383', '2026-11-02')
  try {
    const { federation: r } = await federation(shell.analytics, 2025)
    assert.ok(r)
    assert.deepEqual([r.year, r.distributed, r.surplus], [2025, '2026-11-02', f.surplus])
    assert.deepEqual(Object.fromEntries(r.shares.map((s) => [s.kind, s.amount])), { legal: f.legal, development: f.development, work: f.work, interest: f.interest })
    assert.deepEqual([r.workers, r.associates, r.reserve], [f.workers, f.associates, f.reserve])
    assert.deepEqual([r.credited.amount, r.credited.shares, r.credited.until], [f.employed, f.shares, f.until])
    assert.equal(r.posted.reduce((s, x) => s + x.debit, 0), r.posted.reduce((s, x) => s + x.credit, 0), 'the entry balances')
    assert.equal(r.posted.find((x) => x.code === '1061')?.credit, f.legal, 'the legal reserve takes the legal share')
    assert.ok(!r.posted.some((x) => x.code.startsWith('1013') && x.code !== '1013'), 'a member\'s capital is summed into 1013')
    assert.equal(r.posted.find((x) => x.code === '1013')?.credit, f.employed)
  } finally {
    shell.stop()
  }
})

test('the assembly adopts a rule mixing pay and time from 2027, and its values are copied into the work share\'s terms citing that motion, once', async () => {
  const wording = (salary: string, hours: string) =>
    `The work share is divided among the workers {patronage_salary: ${salary} | more is stricter} in proportion to pay, ` +
    `{patronage_hours: ${hours} | more is stricter} to time worked and {patronage_equal: 0 % | more is stricter} in equal parts. ` +
    '{patronage_capital: 50 % | more is stricter} of each associate\'s part is employed in shares of the capital, and the capital earns ' +
    'interest of at most {patronage_interest: 3.5 % | less is stricter} a year'
  const founding = (await one<{ policy: string }>('SELECT policy FROM patronage.terms WHERE id = $1', [founded])).policy
  const put = (args: Record<string, string>) =>
    propose(
      { circle: 'ag', title: 'Divide the work share by pay and time from 2027', procedure: 'consent', deadline: '2026-11-16', body: '', actions: [{ kind: 'policy', args }] },
      as(camille),
    )
  const rule = { kind: 'rule', wording: wording('60 %', '40 %'), from: '2027-01-01', replaces: founding }
  const short = await put({ ...rule, wording: wording('60 %', '30 %') })
  assert.match(reason(short), /the work share's terms divide 90 % of the work share, not 100 %/)
  const undirected = await put({ ...rule, wording: wording('60 %', '40 %').replace('40 % | more is stricter', '40 %') })
  assert.match(reason(undirected), /patronage_hours is 40 %: a rule's value says which way is stricter/)
  const { replaces: _, ...unplaced } = rule
  const loose = await put(unplaced)
  assert.match(reason(loose), new RegExp(`the work share's terms replace the latest, ${founding}`))

  const motion = settled(await put(rule)).motion
  for (const { member } of await all<{ member: string }>('SELECT member FROM circle_membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-11-16')
  settled(await close({ motion }, as(camille)))
  const then = await react('motion:motion:close', { motion }, as(camille))
  assert.deepEqual(
    then.map((d) => [d.op, d.state, d.then.map((t) => [t.op, t.state])]),
    [['motion:policy:adopt', 'settled', [['document:document:generate', 'settled'], ['patronage:terms:adopt', 'settled']]]],
  )
  const terms = `${motion}-1`
  assert.deepEqual(
    await one(`SELECT policy, "from", salary::float8 AS salary, hours::float8 AS hours, interest::float8 AS interest, to_char(adopted, 'YYYY-MM-DD') AS adopted FROM patronage.terms WHERE id = $1`, [terms]),
    { policy: `${motion}/1`, from: 2027, salary: 60, hours: 40, interest: 3.5, adopted: '2026-11-16' },
  )
  assert.deepEqual(await one(`SELECT patronage.terms_for(2026) AS a, patronage.terms_for(2027) AS b, patronage.basis_of($1) AS basis`, [terms]), { a: founded, b: terms, basis: 'mix' })
  assert.equal((await one<{ ends: string }>(`SELECT to_char(ends, 'YYYY-MM-DD') AS ends FROM policy.policy WHERE id = $1`, [founding])).ends, '2027-01-01', 'the founding rule ends the day the new one applies')
  const again = await adopt({ policy: `${motion}/1`, motion }, as(camille))
  assert.match(reason(again), new RegExp(`${motion}/1 are copied into terms already`))
})

test('the second year runs with no fixture SQL: finance opens 2027, closes 2026 and drafts its split; the assembly moves to approve it; it is approved and distributed', async () => {
  await on('2026-12-01')
  const gap = await open({ month: '2027-02' }, as(julien))
  assert.match(reason(gap), /2027-02 leaves a gap in the periods, which follow one another from 2026-07 to 2027-02/)
  const lead = await open({ month: '2027-01' }, as(hugo))
  assert.match(reason(lead), /close-period/)
  settled(await open({ month: '2027-01' }, as(julien)))
  settled(await open({ month: '2027-01' }, as(julien)))
  assert.deepEqual(await all(`SELECT month FROM account.period WHERE month >= '2026-12' ORDER BY month`), [{ month: '2026-12' }, { month: '2027-01' }])

  await on('2027-01-15')
  for (const { month } of await all<{ month: string }>(`SELECT month FROM account.period WHERE month < '2027' AND closed IS NULL ORDER BY month`)) {
    settled(await closePeriod({ month }, as(julien)))
  }

  const thin = await draft({ year: 2026, surplus: 50_000_00, work: 45_00, legal: 15_00, development: 39_00, interest: 50 }, as(julien))
  assert.match(reason(thin), /2026's shares make 99.50 % of its surplus, not 100 %/)
  const unknown = await draft({ year: 2026, surplus: 50_000_00, work: 45_00, legal: 15_00, development: 39_50, interest: 50 }, as(hugo))
  assert.match(reason(unknown), /distribute-surplus/)
  settled(await draft({ year: 2026, surplus: 40_000_00, work: 45_00, legal: 15_00, development: 39_50, interest: 50 }, as(julien)))
  // Drafted again before the assembly approves it, the latest draft stands.
  const drafted = settled(await draft({ year: 2026, surplus: 50_000_00, work: 45_00, legal: 15_00, development: 39_50, interest: 50 }, as(julien)))
  assert.equal(drafted.distribution, '2026')
  assert.deepEqual(
    await all(`SELECT kind, cella.cents(amount)::int AS cents FROM patronage.share WHERE distribution = '2026' ORDER BY kind`),
    [
      { kind: 'development', cents: 19_750_00 },
      { kind: 'interest', cents: 250_00 },
      { kind: 'legal', cents: 7_500_00 },
      { kind: 'work', cents: 22_500_00 },
    ],
  )
  assert.deepEqual(await one(`SELECT basis, cella.cents(surplus)::int AS surplus FROM patronage.distribution WHERE id = '2026'`), { basis: 'salary', surplus: 50_000_00 })

  const stray = await propose(
    { circle: 'ag', title: 'Approve 2025 again', procedure: 'consent', deadline: '2027-01-29', body: '', actions: [{ kind: 'distribution', args: { distribution: '2025' } }] },
    as(camille),
  )
  assert.match(reason(stray), /2025 was approved on /)
  const proposed = settled(
    await propose(
      { circle: 'ag', title: 'Approve the 2026 distribution', procedure: 'consent', deadline: '2027-01-29', body: '', actions: [{ kind: 'distribution', args: { distribution: '2026' } }] },
      as(camille),
    ),
  )
  const motion = proposed.motion
  for (const { member } of await all<{ member: string }>('SELECT member FROM circle_membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2027-01-29')
  settled(await close({ motion }, as(camille)))
  const old = await approve({ distribution: '2026', motion: 'm-2026-006' }, as(camille))
  assert.match(reason(old), /m-2026-006 does not approve 2026/)
  settled(await approve({ distribution: '2026', motion }, as(camille)))
  const shared = await one<{ n: number; cents: number }>(
    `SELECT count(*)::int AS n, sum(cella.cents(amount))::int AS cents FROM patronage.part WHERE distribution = '2026' AND basis = 'salary'`,
  )
  assert.equal(shared.cents, 22_500_00, 'the parts add up to the work share')
  assert.ok(shared.n >= 10)
  const redraft = await draft({ year: 2026, surplus: 60_000_00, work: 45_00, legal: 15_00, development: 39_50, interest: 50 }, as(julien))
  assert.match(reason(redraft), /the 2026 surplus was approved on 2027-01-29/)

  // Camille closed the motion and approved the split: the distribution
  // and each credit of shares follow, each signed by her.
  const then = await react('patronage:distribution:approve', { distribution: '2026', motion }, as(camille))
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['patronage:distribution:distribute', 'settled']])
  assert.ok(then[0].then.length > 0)
  for (const c of then[0].then) {
    assert.equal(`${c.op} ${c.state}`, 'patronage:part:employ settled', c.reason)
  }
  const signed = await all<{ op: string; actor: string }>('SELECT op, actor FROM cella.log WHERE n = ANY($1::bigint[]) ORDER BY n', [[then[0].entry, ...then[0].then.map((c) => c.entry)]])
  assert.deepEqual(new Set(signed.map((s) => s.actor)), new Set([camille]))
  assert.deepEqual(signed.map((s) => s.op), ['patronage:distribution:distribute', ...then[0].then.map(() => 'patronage:part:employ')])
  assert.deepEqual(await one(`SELECT to_char(distributed, 'YYYY-MM-DD') AS d FROM patronage.distribution WHERE id = '2026'`), { d: '2027-01-29' })
  const credited = await one<{ n: number; cents: number }>(`SELECT count(*)::int AS n, sum(cella.cents(amount))::int AS cents FROM account_membership_patronage_transaction.credit WHERE distribution = '2026'`)
  assert.equal(credited.n, then[0].then.length)
  const split = await one<{ cents: number }>(`SELECT sum(capital)::int AS cents FROM account_membership_patronage.split WHERE distribution = '2026' AND shares > 0`)
  assert.equal(credited.cents, split.cents, 'the credits are what the split employs in shares, to the cent')
  assert.equal(await balance('424'), -(27_630_00 - capital2025 + 22_500_00 - credited.cents), '424 still owes the cash of both years')
  await balanced()
})
