// Mandates form a provenance tree, end to end on a seeded Lanterne,
// through the handlers: every mandate of the founding motion is a root
// the assembly issued; the assembly grants coordination approve-expense
// within 1 000 € a month until the end of 2027, and coordination, under
// it, grants Web's lead the same; a grant of 2 000 € a month under it is
// refused, as is one outlasting its term; the chain of Web's lead's
// mandate reads from the assembly down; handing Web's lead from Amina
// to Léa revokes no mandate; and the assembly ending coordination's
// mandate revokes Web's lead's under it the same day, after which
// Léa's approval is refused. Run by `cella test e2e provenance`.
// unfolded: it stages Web's lead role around the notary, which its logged writes then name, since no write makes a role yet

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, story } = createStory()
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { capture, submit as claim } from '@cella/org-expense/api'
import { approve as approveExpense } from '@cella/org-graft-expense-transaction/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const amina = at('amina')
const lea = at('lea')
const thomas = at('thomas')

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}

const may = async (actor: string, power: string, day: string) =>
  (await one<{ may: boolean }>('SELECT circle_person.may($1, $2, NULL, NULL, $3) AS may', [actor, power, day])).may

// An expense Thomas, of Web, spends on `day` and claims: 50 € and its VAT.
async function spent(label: string, day: string) {
  const { expense } = settled(await capture({ member: thomas, day, label, category: '606', net: 50_00, vat: 10_00, receipt: null }, as(thomas)))
  settled(await claim({ expense }, as(thomas)))
  return expense
}

// A motion of `circle` carrying its actions, consented to by everyone on
// its roll and carried out on its deadline; returns what was carried.
async function decided(circle: string, title: string, actions: { kind: string; args: Record<string, string> }[], from: string, deadline: string) {
  await on(from)
  const { motion } = settled(await propose({ circle, title, procedure: 'consent', deadline, body: '', actions }, as(camille)))
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return carried(motion, as(camille))
}

const mandate = (grantee: string, budget: string, until?: string) => ({
  kind: 'policy',
  args: {
    kind: 'mandate',
    wording: `The {${grantee === 'coordination' ? 'circle' : 'role'}: ${grantee}} ${grantee === 'coordination' ? 'circle' : 'role'} holds {power: approve-expense}, to approve what Web's members spend, within {budget: ${budget}} a {per: month}`,
    ...(until ? { until } : {}),
  },
})

before(async () => {
  await su.connect()
  // The host stages Web's own lead role around the notary, as only a
  // superuser may: no write makes a role yet.
  await su.query('SET cella.unbound = on')
  await su.query(`INSERT INTO circle.role (id, circle, name, duty, holders) VALUES ('web-lead', 'web', 'Web lead', 'runs Web', 1)`)
})

after(async () => {
  await app.end()
  await su.end()
})

test('every mandate of the founding motion is a root the assembly issued', async () => {
  assert.deepEqual(
    await one(
      `SELECT count(*)::int AS mandates, count(*) FILTER (WHERE m.issuer = 'ag' AND m.parent IS NULL)::int AS roots
       FROM circle.mandate m JOIN policy.policy r ON r.id = m.policy WHERE r.motion = 'm-2021-001'`,
    ),
    { mandates: 55, roots: 55 },
  )
})

test('a circle grants nothing it holds no mandate for: coordination may not grant Web\'s lead approve-expense yet', async () => {
  const out = await decided('coordination', 'Web\'s lead approves its expenses', [mandate('web-lead', '1 000 €')], '2026-11-02', '2026-11-09')
  assert.deepEqual(out.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'refused']])
  assert.match(out[0].reason ?? '', /grants approve-expense to web-lead, issued by coordination, which holds no mandate for approve-expense to issue it under/)
})

test('coordination, under the assembly\'s mandate, grants Web\'s lead approve-expense within 1 000 € a month; 2 000 € and a longer term are refused', async () => {
  const granted = await decided(
    'ag',
    'Coordination approves the working circles\' expenses',
    [mandate('coordination', '1 000 €', '2027-12-31')],
    '2026-11-09',
    '2026-11-16',
  )
  assert.deepEqual(granted.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  const out = await decided(
    'coordination',
    'Web\'s lead approves its expenses',
    [mandate('web-lead', '1 000 €', '2027-12-31'), mandate('web-lead', '2 000 €', '2027-12-31'), mandate('web-lead', '500 €')],
    '2026-11-16',
    '2026-11-23',
  )
  assert.deepEqual(out.map((d) => [d.op, d.state]), [
    ['motion:policy:adopt', 'settled'],
    ['motion:policy:adopt', 'refused'],
    ['motion:policy:adopt', 'refused'],
  ])
  assert.match(out[1].reason ?? '', /its cap, within 2000\.00 € a month, is wider than its parent's, within 1000\.00 € a month/)
  assert.match(out[2].reason ?? '', /it outlasts its parent, which ends on 2027-12-31/)
  assert.deepEqual(
    await all(
      `SELECT m.grantee, m.issuer, p.grantee AS parent, cella.cents(m.budget)::int AS budget, to_char(m.until, 'YYYY-MM-DD') AS until
       FROM circle.mandate m LEFT JOIN circle.mandate p ON p.id = m.parent
       WHERE m.power = 'approve-expense' AND m.grantee IN ('coordination', 'web-lead') ORDER BY m.id`,
    ),
    [
      { grantee: 'coordination', issuer: 'ag', parent: null, budget: 100000, until: '2027-12-31' },
      { grantee: 'web-lead', issuer: 'coordination', parent: 'coordination', budget: 100000, until: '2027-12-31' },
    ],
  )
})

test('the chain of Web\'s lead\'s mandate reads from the assembly down', async () => {
  const { id } = await one<{ id: string }>(`SELECT id FROM circle.mandate WHERE grantee = 'web-lead' AND power = 'approve-expense'`)
  assert.deepEqual(await all(`SELECT grantee, issuer, depth FROM circle.chain($1)`, [id]), [
    { grantee: 'coordination', issuer: 'ag', depth: 0 },
    { grantee: 'web-lead', issuer: 'coordination', depth: 1 },
  ])
})

test('handing Web\'s lead from Amina to Léa revokes no mandate, and each approves a Web expense under it', async () => {
  // The host stages Amina's tenure of Web's lead, as only a superuser may.
  await su.query(`INSERT INTO circle.tenure (circle, holder, role, since) VALUES ('web', $1, 'web-lead', '2026-11-23')`, [amina])
  await on('2026-11-23')
  settled(await approveExpense({ expense: await spent('Usability test incentives', '2026-11-23') }, as(amina)))

  const standing = `SELECT count(*)::int AS n FROM circle.mandate WHERE grantee IN ('coordination', 'web-lead') AND power = 'approve-expense' AND revoked IS NULL`
  assert.deepEqual(await one(standing), { n: 2 })
  const out = await decided(
    'ag',
    'Léa leads Web after Amina',
    [
      { kind: 'unseat', args: { circle: 'web', member: amina, role: 'web-lead' } },
      { kind: 'seat', args: { circle: 'web', member: lea, role: 'web-lead' } },
    ],
    '2026-11-23',
    '2026-11-30',
  )
  assert.deepEqual(out.map((d) => [d.op, d.state]), [
    ['circle:seat:remove', 'settled'],
    ['circle:seat:add', 'settled'],
  ])
  assert.deepEqual(await one(standing), { n: 2 }, 'the handover ends no mandate')
  settled(await approveExpense({ expense: await spent('Screen reader licence', '2026-11-30') }, as(lea)))
  assert.notEqual(reason(await approveExpense({ expense: await spent('Accessibility audit', '2026-11-30') }, as(amina))), '', 'Amina no longer holds the role')
})

test('the assembly ending coordination\'s approve-expense revokes Web\'s lead\'s under it the same day, and Léa\'s next approval is refused', async () => {
  const mandates = async () =>
    all<{ grantee: string; revoked: string | null }>(
      `SELECT grantee, to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.mandate
       WHERE power = 'approve-expense' AND grantee IN ('coordination', 'web-lead') ORDER BY id`,
    )
  const { id: up, policy } = await one<{ id: string; policy: string }>(
    `SELECT id, policy FROM circle.mandate WHERE grantee = 'coordination' AND power = 'approve-expense'`,
  )
  const { id: down } = await one<{ id: string }>(`SELECT id FROM circle.mandate WHERE grantee = 'web-lead' AND power = 'approve-expense'`)
  const out = await decided('ag', 'Coordination no longer approves the working circles\' expenses', [{ kind: 'end', args: { policy } }], '2026-11-30', '2026-12-07')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  assert.deepEqual(await mandates(), [
    { grantee: 'coordination', revoked: '2026-12-07' },
    { grantee: 'web-lead', revoked: '2026-12-07' },
  ])
  // The end says each mandate it revoked, the ended one first.
  const entry = await one<{ form: { mandate: number; revoked: number[] } }>(
    `SELECT form FROM cella.log WHERE op = 'motion:policy:end' ORDER BY n DESC LIMIT 1`,
  )
  assert.deepEqual([entry.form.mandate, entry.form.revoked], [Number(up), [Number(up), Number(down)]])
  // Web's lead's policy stays in the register; its mandate grants nothing.
  assert.equal(await may(lea, 'approve-expense', '2026-12-07'), false)
  assert.match(reason(await approveExpense({ expense: await spent('Font licence', '2026-12-07') }, as(lea))), /approve-expense/)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})

if (!process.env.CELLA_STORY) runTest('provenance story', async (t) => story((name, step) => t.test(name, step)))
