// The patronage scenario, end to end on a seeded Lanterne, through the
// handlers: the 2025 distribution is approved by d-2026-006, and in that
// one write its work share divides among the ten members by what each was
// paid in 2025, as the statutes' terms say; once finance distributes it,
// half of each part buys whole shares, blocked five years, and the rest
// is owed in cash. The parts, the shares, the cash and the books
// reconcile to the cent; each member reads their own statement, and
// finance the year's return. Then the assembly decides new terms, a mix
// of pay and time from 2027, and they are adopted citing that decision,
// never one that does not move them nor over a year already approved.
// Run by `cella test e2e patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { adopt, approve, statement, statements } from '@cella/org-patronage/api'
import { distribute } from '@cella/org-graft-patronage-transaction/api'
import { employed, figures, owed } from '@cella/org-graft-account-membership-patronage-transaction/api'
import { propose, vote } from '@cella/org-decision/api'
import { close } from '@cella/org-graft-circle-decision-membership/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const hugo = 'hugo@lanterne.example'
const chloe = 'chloe@lanterne.example'
const share = 50_00

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
  assert.deepEqual(terms, { terms: 'st-2021', basis: 'salary' })
  before2025 = new Map(
    (await all<{ member: string; shares: number; b: string }>(
      `SELECT c.member, c.shares, coalesce((SELECT -b.balance FROM account_transaction.balance b WHERE b.code = c.account), 0) AS b
       FROM account_membership.capital c WHERE c.account IS NOT NULL`,
    )).map((r) => [r.member, { shares: r.shares, capital: Number(r.b) }]),
  )
})

test('approving 2025 divides the work share by pay, to the cent, in the same write, and is not yet distributed', async () => {
  await on('2026-11-02')
  const done = await approve({ distribution: '2025', decision: 'd-2026-006' }, as(camille))
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

test('only finance distributes the approved split, once', async () => {
  const lead = await distribute({ distribution: '2025' }, as(hugo))
  assert.match(reason(lead), /distribute-surplus/)
  const done = await distribute({ distribution: '2025' }, as(julien))
  settled(done)
  const again = await distribute({ distribution: '2025' }, as(julien))
  assert.match(reason(again), /the 2025 surplus was distributed on 2026-11-02/)
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
  assert.equal(new Set(credits.map((c) => c.entry)).size, 1, 'one entry posts them')

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
  assert.equal(sheet?.terms?.id, 'st-2021')

  const became = await employed(app, id)
  assert.equal((became?.capital ?? 0) + (became?.cash ?? 0), part)
  assert.equal(became?.movements.at(-1)?.balance, (await one<{ shares: number }>('SELECT shares FROM membership.member WHERE address = $1', [camille])).shares * share)
  assert.equal(became?.movements.at(-1)?.amount, became?.capital)

  assert.deepEqual((await owed(app, camille, camille)).map((s) => [s.id, s.part, s.capital + s.cash, s.capital, s.distributed]), [[id, part, part, became?.capital, true]])
  assert.deepEqual(await owed(await reading(julien), camille, julien), [])
})

test('the year\'s return to the federation reconciles with the split, the parts and the shares', async () => {
  const f = Object.fromEntries((await figures(await reading(julien), '2025')).map((x) => [x.id, x.value]))
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

test('the assembly decides terms mixing pay and time from 2027, and they are adopted citing that decision alone', async () => {
  // Stands in for drafting terms, which has no write of its own yet.
  await su.query(`INSERT INTO patronage.terms (id, "from", salary, hours, capital) VALUES ('st-2027', 2027, 60, 40, 50), ('st-2025', 2025, 50, 50, 50)`)

  const early = await adopt({ terms: 'st-2025', decision: 'd-2026-006' }, as(camille))
  assert.match(reason(early), /st-2025 would govern 2025, whose distribution is approved|d-2026-006 does not adopt st-2025/)
  const astray = await adopt({ terms: 'st-2027', decision: 'd-2026-006' }, as(camille))
  assert.match(reason(astray), /d-2026-006 does not adopt st-2027/)

  const proposed = settled(
    await propose(
      { circle: 'ag', title: 'Divide the work share by pay and time from 2027', procedure: 'consent', deadline: '2026-11-16', body: '', motions: [{ kind: 'patronage', args: { terms: 'st-2027' } }] },
      as(camille),
    ),
  )
  const decision = proposed.decision
  for (const { member } of await all<{ member: string }>('SELECT member FROM circle_decision_membership.roll WHERE decision = $1', [decision])) {
    settled(await vote({ decision, member, stance: 'consent' }, as(member)))
  }
  const open = await adopt({ terms: 'st-2027', decision }, as(camille))
  assert.match(reason(open), new RegExp(`${decision} is not closed`))

  await on('2026-11-16')
  settled(await close({ decision }, as(camille)))
  const adopted = settled(await adopt({ terms: 'st-2027', decision }, as(camille)))
  assert.equal(adopted.adopted, '2026-11-16')
  assert.deepEqual(await one(`SELECT patronage.terms_for(2026) AS a, patronage.terms_for(2027) AS b, patronage.basis_of('st-2027') AS basis`), { a: 'st-2021', b: 'st-2027', basis: 'mix' })
  const again = await adopt({ terms: 'st-2027', decision }, as(camille))
  assert.match(reason(again), /st-2027 were adopted on 2026-11-16/)
})
