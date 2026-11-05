// Collective mandates, end to end on a seeded Lanterne, through the
// handlers: a circle holds a mandate as a whole and uses it only by
// motion. The founding motion grants the assembly's and coordination's,
// and no working circle's; the assembly's m-2026-012 admits Inès under its
// `admit-member`, while the same admission put in Web is refused at its
// proposal; the assembly ends coordination's `adopt-document`, and
// coordination's next adoption is refused; and a collective mandate
// coordination issues wider than the one it holds is refused as it is
// adopted, by `circle.narrows`. The assembly keeps a collective
// `adopt-policy` with no `until`: a motion ending its last, replacing it
// with one that lapses, or ending it before adopting another is refused
// at its proposal, and of two motions each ending one of two, the end
// carried out second is refused as it is written (`circle.sovereign`);
// through it, it grants itself again an `end-policy` it let lapse. One
// that applies only from a later day keeps nothing until then: a motion
// ending its only one in force beside adopting such a one is refused at
// its proposal, and the end is refused as it is written once the other
// in force has gone, while a replacement in force at once carries. Run
// by `cella test e2e collective`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { done, type Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { reacting } from '../src/lib/server/slices.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const ines = at('ines')
const amina = at('amina')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

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
const holds = async (circle: string, power: string, day = '2026-10-24') =>
  (await one<{ h: boolean }>(`SELECT circle.holds($1, $2, $3) AS h`, [circle, power, day])).h

// A motion of the assembly carrying its actions, passed by consent and
// carried out on its deadline; returns the motion and what was carried.
async function decided(title: string, actions: { kind: string; args: Record<string, string> }[], from: string, deadline: string) {
  await on(from)
  const { motion } = settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline, body: '', actions }, as(camille)))
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return { motion, out: await carried(motion, as(camille)) }
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the founding motion grants the assembly\'s collective mandates and coordination\'s, each a policy on a circle, and no working circle\'s', async () => {
  const held = await all<{ circle: string; powers: string[] }>(
    `SELECT m.grantee AS circle, array_agg(m.power ORDER BY m.power) AS powers
     FROM circle.mandate m JOIN policy.policy r ON r.id = m.policy JOIN circle.grantee g ON g.id = m.grantee
     WHERE g.kind = 'circle' AND r.motion = 'm-2021-001' AND m.revoked IS NULL
     GROUP BY m.grantee ORDER BY m.grantee`,
  )
  assert.deepEqual(held, [
    {
      circle: 'ag',
      powers: ['admit-member', 'adopt-document', 'adopt-policy', 'approve-distribution', 'create-circle', 'end-policy', 'exclude-member', 'seat-member', 'suspend-member'],
    },
    { circle: 'coordination', powers: ['adopt-document', 'adopt-policy', 'end-policy', 'seat-member'] },
  ])
  assert.equal(
    (await one<{ sentence: string }>(`SELECT policy.sentence(w.legal) AS sentence FROM policy.wording w WHERE w.policy = 'm-2021-001/47'`)).sentence,
    'The ag circle holds admit-member, to admit members, by motion',
  )
  assert.equal(await holds('ag', 'admit-member'), true)
  assert.equal(await holds('coordination', 'admit-member'), false)
  assert.equal(await holds('web', 'admit-member'), false)
})

test('the same admission put in Web is refused at its proposal, Web holding no collective mandate to admit', async () => {
  const astray = await propose(
    { circle: 'web', title: 'Admit Inès Haddad as a member', procedure: 'consent', deadline: '2026-11-07', body: '', actions: [{ kind: 'admit', args: { member: ines, shares: 20 } }] },
    as(amina),
  )
  assert.match(reason(astray), /web holds no collective mandate for admit-member, so its motion may not admit a member/)
  // A motion of Web carrying nothing needs no collective mandate.
  settled(await propose({ circle: 'web', title: 'Move the stand-up to 9:30', procedure: 'consent', deadline: '2026-11-07', body: '', actions: [] }, as(amina)))
})

test('the assembly\'s m-2026-012 admits Inès under its collective admit-member, and seats her', async () => {
  await on('2026-10-31')
  const closed = await close({ motion: 'm-2026-012' }, reacting(as(camille)))
  settled(closed)
  assert.deepEqual(done('motion:motion:close', closed).then.map((d) => [d.op, d.state]), [['membership:member:admit', 'settled']])
  assert.deepEqual(await one(`SELECT status FROM membership.member WHERE address = $1`, [ines]), { status: 'active' })
})

test('the assembly ends coordination\'s adopt-document, and coordination\'s next adoption is refused at its proposal', async () => {
  await on('2026-11-01')
  const adopting = { kind: 'adopt', args: { version: 'rate-card-2027@2' } }
  const before = await propose({ circle: 'coordination', title: 'Adopt the 2027 rate card', procedure: 'consent', deadline: '2026-11-15', body: '', actions: [adopting] }, as(camille))
  assert.equal(before.state, 'settled', reason(before))
  const adopts = (await one<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE grantee = 'coordination' AND power = 'adopt-document'`)).policy
  const { out } = await decided('Coordination adopts no document', [{ kind: 'end', args: { policy: adopts } }], '2026-11-01', '2026-11-15')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  assert.equal(await holds('coordination', 'adopt-document', '2026-11-14'), true)
  assert.equal(await holds('coordination', 'adopt-document', '2026-11-15'), false)
  const after = await propose({ circle: 'coordination', title: 'Adopt the 2027 rate card', procedure: 'consent', deadline: '2026-11-29', body: '', actions: [adopting] }, as(camille))
  assert.match(reason(after), /coordination holds no collective mandate for adopt-document, so its motion may not adopt a document version/)
})

test('a collective mandate wider than the one it is issued under is refused as it is adopted: coordination may not grant Web budgets of 20 000 € under its own 10 000 €', async () => {
  const { out: granted } = await decided(
    'Coordination sets budgets by motion',
    [{ kind: 'policy', args: { kind: 'mandate', wording: 'The {circle: coordination} circle holds {power: set-budget}, to set a project\'s budget by motion, up to {limit: 10 000 €} a write' } }],
    '2026-11-15',
    '2026-11-29',
  )
  assert.deepEqual(granted.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  await on('2026-11-29')
  const { motion } = settled(
    await propose(
      {
        circle: 'coordination',
        title: 'Web sets budgets by motion',
        procedure: 'consent',
        deadline: '2026-12-06',
        body: '',
        actions: [{ kind: 'policy', args: { kind: 'mandate', wording: 'The {circle: web} circle holds {power: set-budget}, to set a project\'s budget by motion, up to {limit: 20 000 €} a write' } }],
      },
      as(camille),
    ),
  )
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-12-06')
  settled(await close({ motion }, as(camille)))
  const out = await carried(motion, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'refused']])
  assert.match(out[0].reason ?? '', /grants set-budget to web, issued by coordination, is wider than mandate \d+ it is issued under: its cap, up to 20000\.00 € a write, is wider than its parent's, up to 10000\.00 € a write/)
  assert.deepEqual(await all(`SELECT m.grantee AS circle, cella.cents(m."limit")::int AS "limit" FROM circle.mandate m JOIN circle.grantee g ON g.id = m.grantee WHERE m.power = 'set-budget' AND g.kind = 'circle'`), [
    { circle: 'coordination', limit: 1000000 },
  ])
})

// A motion of the assembly put, voted for by its whole roll and carried
// out on its deadline, whatever procedure its requirements fix.
async function carriedOut(title: string, actions: { kind: string; args: Record<string, string> }[], from: string, deadline: string) {
  await on(from)
  const { motion } = settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline, body: '', actions }, as(camille)))
  const { method } = await one<{ method: string }>('SELECT method FROM motion.motion WHERE id = $1', [motion])
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: method === 'consent' ? 'consent' : 'for' }, as(member)))
  }
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return { motion, out: await carried(motion, as(camille)) }
}

const adopts = async () =>
  (await all<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE grantee = 'ag' AND power = 'adopt-policy' AND until IS NULL AND revoked IS NULL ORDER BY id`)).map((m) => m.policy)
const adoptPolicy = (extra: Record<string, string> = {}) => ({
  kind: 'policy',
  args: { kind: 'mandate', wording: 'The {circle: ag} circle holds {power: adopt-policy}, to adopt policies, the statutes\' among them, by motion', ...extra },
})
const lose = /ag would lose its power to adopt policies: mandate \d+ of m-2021-001\/51 is its last collective adopt-policy mandate in force with no until; adopting another with no from and no until in its place, in the same motion and before ending it, keeps it/

test('the assembly may not end its last collective adopt-policy, nor replace it with one that lapses, nor end it before adopting another: each is refused at its proposal', async () => {
  await on('2026-12-06')
  assert.deepEqual(await adopts(), ['m-2021-001/51'])
  const put = async (actions: { kind: string; args: Record<string, string> }[]) =>
    reason(await propose({ circle: 'ag', title: 'The assembly adopts no policy', procedure: 'consent', deadline: '2026-12-20', body: '', actions }, as(camille)))
  assert.match(await put([{ kind: 'end', args: { policy: 'm-2021-001/51' } }]), lose)
  assert.match(await put([adoptPolicy({ replaces: 'm-2021-001/51', until: '2027-12-31' })]), lose)
  assert.match(await put([{ kind: 'end', args: { policy: 'm-2021-001/51' } }, adoptPolicy()]), lose)
})

test('a motion replacing the assembly\'s adopt-policy with one with no until carries, and the assembly holds the new one', async () => {
  const { out } = await carriedOut('The assembly restates its power to adopt policies', [adoptPolicy({ replaces: 'm-2021-001/51' })], '2026-12-06', '2026-12-20')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  const [now] = await adopts()
  assert.notEqual(now, 'm-2021-001/51')
  assert.equal(await holds('ag', 'adopt-policy', '2026-12-20'), true)
})

test('the assembly lets its end-policy lapse at an until, and a later motion of it grants itself end-policy again', async () => {
  const { policy } = await one<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE grantee = 'ag' AND power = 'end-policy' AND revoked IS NULL`)
  const endPolicy = 'The {circle: ag} circle holds {power: end-policy}, to end policies, by motion'
  const { out: lapsing } = await carriedOut(
    'The assembly ends policies until 10 January',
    [{ kind: 'policy', args: { kind: 'mandate', wording: endPolicy, replaces: policy, until: '2027-01-10' } }],
    '2026-12-20',
    '2027-01-03',
  )
  assert.deepEqual(lapsing.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.equal(await holds('ag', 'end-policy', '2027-01-09'), true)
  assert.equal(await holds('ag', 'end-policy', '2027-01-10'), false)
  const { out: again } = await carriedOut('The assembly ends policies again', [{ kind: 'policy', args: { kind: 'mandate', wording: endPolicy } }], '2027-01-10', '2027-01-24')
  assert.deepEqual(again.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.equal(await holds('ag', 'end-policy', '2027-01-24'), true)
})

test('two motions each ending one of the assembly\'s two adopt-policy mandates pass their proposals, and the end carried out second is refused as it is written', async () => {
  const { out } = await carriedOut('The assembly holds a second power to adopt policies', [adoptPolicy()], '2027-01-24', '2027-02-07')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  const [first, second] = await adopts()
  await on('2027-02-07')
  const put = async (policy: string) => {
    const { motion } = settled(
      await propose({ circle: 'ag', title: `End ${policy}`, procedure: 'consent', deadline: '2027-02-21', body: '', actions: [{ kind: 'end', args: { policy } }] }, as(camille)),
    )
    const { method } = await one<{ method: string }>('SELECT method FROM motion.motion WHERE id = $1', [motion])
    for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
      settled(await vote({ motion, member, stance: method === 'consent' ? 'consent' : 'for' }, as(member)))
    }
    return motion
  }
  const ending = [await put(first), await put(second)]
  await on('2027-02-21')
  const outs = []
  for (const motion of ending) {
    settled(await close({ motion }, as(camille)))
    outs.push(await carried(motion, as(camille)))
  }
  assert.deepEqual(outs.map((o) => o.map((d) => [d.op, d.state])), [[['motion:policy:end', 'settled']], [['motion:policy:end', 'refused']]])
  assert.match(outs[1][0].reason ?? '', new RegExp(`ag would lose its power to adopt policies: mandate \\d+ of ${second} is its last collective adopt-policy mandate in force with no until`))
  assert.deepEqual(await adopts(), [second])
})

// A motion of the assembly put and voted for by its whole roll, closed
// and carried out later.
const voted = async (title: string, actions: { kind: string; args: Record<string, string> }[], deadline: string) => {
  const { motion } = settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline, body: '', actions }, as(camille)))
  const { method } = await one<{ method: string }>('SELECT method FROM motion.motion WHERE id = $1', [motion])
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: method === 'consent' ? 'consent' : 'for' }, as(member)))
  }
  return motion
}

test('a motion of the assembly adopting an adopt-policy that applies only from a later day, and ending or replacing its only one in force, is refused at its proposal', async () => {
  await on('2027-02-21')
  const [only] = await adopts()
  const put = async (actions: { kind: string; args: Record<string, string> }[]) =>
    reason(await propose({ circle: 'ag', title: 'The assembly adopts policies from June', procedure: 'consent', deadline: '2027-03-07', body: '', actions }, as(camille)))
  const later = new RegExp(
    `ag would lose its power to adopt policies: mandate \\d+ of ${only} is its last collective adopt-policy mandate in force with no until; adopting another with no from and no until in its place`,
  )
  assert.match(await put([adoptPolicy({ from: '2027-06-01' }), { kind: 'end', args: { policy: only } }]), later)
  assert.match(await put([adoptPolicy({ replaces: only, from: '2027-06-01' })]), later)
})

test('an end leaving the assembly only an adopt-policy that applies from a later day is refused as it is written, and one whose replacement is in force on the verdict date carries', async () => {
  const { out } = await carriedOut('The assembly holds a second power to adopt policies again', [adoptPolicy()], '2027-02-21', '2027-03-07')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  const [first, second] = await adopts()
  // Each passes its proposal: the other's mandate stays in force.
  await on('2027-03-07')
  const late = await voted('The assembly adopts policies from June', [adoptPolicy({ from: '2027-06-01' }), { kind: 'end', args: { policy: first } }], '2027-03-28')
  const early = await voted(`End ${second}`, [{ kind: 'end', args: { policy: second } }], '2027-03-21')
  await on('2027-03-21')
  settled(await close({ motion: early }, as(camille)))
  assert.deepEqual((await carried(early, as(camille))).map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  await on('2027-03-28')
  settled(await close({ motion: late }, as(camille)))
  const outs = await carried(late, as(camille))
  assert.deepEqual(outs.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled'], ['motion:policy:end', 'refused']])
  assert.match(outs[1].reason ?? '', new RegExp(`ag would lose its power to adopt policies: mandate \\d+ of ${first} is its last collective adopt-policy mandate in force with no until`))
  const [still, june] = await adopts()
  assert.equal(still, first)
  assert.equal((await one<{ from: string }>(`SELECT to_char("from", 'YYYY-MM-DD') AS from FROM circle.mandate WHERE policy = $1`, [june])).from, '2027-06-01')
  const { out: now } = await carriedOut('The assembly restates its power to adopt policies at once', [adoptPolicy(), { kind: 'end', args: { policy: first } }], '2027-03-28', '2027-04-11')
  assert.deepEqual(now.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', ''], ['motion:policy:end', 'settled', '']])
  assert.equal(await holds('ag', 'adopt-policy', '2027-04-11'), true)
  assert.equal((await adopts()).includes(first), false)
})
