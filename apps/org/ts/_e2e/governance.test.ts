// The governance scenario, end to end on a seeded Lanterne, through the
// handlers: Malik invites a friend by a link, which she takes up on her
// laptop, enrolling it; the assembly admits her and the close seats her
// and subscribes her in its transaction, each an effect citing the one it
// follows; a suspension by motion stops a
// member's writes; circles never nest, so no motion nests one; a
// mandate is granted by motion, a policy copied into its mandate, put to
// a circle holding a mandate it is no wider than and issued under it,
// and one no circle holds a mandate to issue under is put to the
// assembly, which issues it as a root; and a lead approves the
// time of their own circle alone, the treasurer everyone's. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { circles, propose as proposeAlone, vote } from '@cella/org-motion/api'
import type { circles as circleMotions } from '@cella/org-motion/models'
import { close, propose, put } from '@cella/org-graft-membership-motion/api'
import { accept, invite, link as link_ } from '@cella/org-membership/api'
import { approve, log, submit } from '@cella/org-timesheet/api'
import { done, type Deps } from '@cella/org-db'
import { fixture, random, sha256, signer } from '@cella/org-sign'
import { reader, scope, sign } from './lanterne.ts'
import { reacting } from '../src/lib/server/slices.ts'

const su = new pg.Client()
let app: pg.Client

const malik = 'malik@lanterne.example'
const camille = 'camille@lanterne.example'
const chloe = 'chloe@lanterne.example'
const hugo = 'hugo@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const thomas = 'thomas@lanterne.example'
const nadia = 'nadia@lanterne.example'
const amina = 'amina@lanterne.example'
const julien = 'julien@lanterne.example'
const coordination = [camille, yusuf, hugo, malik, julien]

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps =>
  reacting(actor === nadia ? { db: reader(app, actor), actor, sign: signer(scope, nadia, fixture(nadia, 'laptop')) } : { db: reader(app, actor), actor, sign: sign(actor) })
// What a circle's page proposes about it, put as the shell puts it.
const putCircle = async (m: circleMotions.Put, deps: Deps) => propose(await circles.putting(m, deps.db), deps)
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const status = async (m: string) => (await one<{ status: string }>('SELECT status FROM membership.member WHERE address = $1', [m]))?.status
// A motion closed by Camille, and what its close carried in its
// transaction.
const closing = async (motion: string) => {
  const outcome = await close({ motion }, as(camille))
  settled(outcome)
  return done('motion:motion:close', outcome).then
}

// Every member on a motion's roll consents.
async function consented(motion: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
}

before(async () => {
  await su.connect()
  // The host stages a seat around the notary, as only a superuser may.
  await su.query('SET cella.unbound = on')
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

let admission = ''

test('Malik invites Nadia with a link; she takes it up on her laptop, which signs its own enrolment, and the link is spent', async () => {
  const laptop = await fixture(nadia, 'laptop')
  const secret = random()
  const link = await sha256(secret)
  const invited = settled(await invite({ address: nadia, name: 'Nadia Benali', link }, as(malik)))
  assert.deepEqual(invited, { member: nadia, invited: '2026-10-24', link })
  assert.equal(await status(nadia), 'invited')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM person.device WHERE address = $1', [nadia])).n, '0')

  await assert.rejects(accept({ member: nadia, secret: random(), key: laptop.key, label: 'laptop' }, as(nadia)), /this link is not an invitation of nadia/)
  const other = await fixture(nadia, 'phone')
  const forged = await accept({ member: nadia, secret, key: other.key, label: 'phone' }, as(nadia))
  assert.equal(forged.state, 'refused', 'a device is enrolled only by an acceptance it signs itself')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM person.device WHERE address = $1', [nadia])).n, '0')

  const accepted = settled(await accept({ member: nadia, secret, key: laptop.key, label: 'laptop' }, as(nadia)))
  assert.deepEqual(accepted, { member: nadia, link, key: laptop.key, accepted: '2026-10-24' })
  assert.deepEqual(
    await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled, enrolled_by FROM person.device WHERE address = $1`, [nadia]),
    { label: 'laptop', enrolled: '2026-10-24', enrolled_by: null },
  )
  await assert.rejects(accept({ member: nadia, secret, key: laptop.key, label: 'laptop' }, as(nadia)), /has taken up their invitation already/)
  const spent = await link_({ member: nadia, link: await sha256(random()) }, as(malik))
  assert.match(reason(spent), /has taken up their invitation/, 'no new link once one is taken up')
})

test('only the assembly admits, the one circle holding the collective admit-member: coordination may not; Malik proposes Nadia\'s admission to the assembly', async () => {
  const astray = await propose(
    { circle: 'coordination', title: 'Admit Nadia', procedure: 'consent', deadline: '2026-11-07', body: '', actions: [{ kind: 'admit', args: { member: nadia, shares: 20 } }] },
    as(camille),
  )
  assert.match(reason(astray), /coordination holds no collective mandate for admit-member, so its motion may not admit a member/)
  // The motion feat's proposal alone fixes no roll, and is refused.
  const alone = await proposeAlone(
    { circle: 'ag', title: 'Admit Nadia', procedure: 'consent', deadline: '2026-11-07', body: '', actions: [{ kind: 'admit', args: { member: nadia, shares: 20 } }] },
    as(malik),
  )
  assert.match(reason(alone), /'s proposal did not fix its roll: its roll is those its procedure calls in ag on the day it is proposed/)

  const proposed = settled(await put({ kind: 'admit', args: { member: nadia, shares: 20 }, deadline: '2026-11-07', body: 'Nadia has worked with marketing since spring.' }, as(malik)))
  admission = proposed.motion
  assert.equal(admission, 'm-2026-015')
  const d = await one<{ circle: string; title: string; roll: string }>(
    `SELECT circle, title, (SELECT count(*) FROM membership_motion.roll r WHERE r.motion = d.id) AS roll FROM motion.motion d WHERE id = $1`,
    [admission],
  )
  assert.deepEqual(d, { circle: 'ag', title: 'Admit Nadia Benali as a member', roll: '10' })
  await consented(admission)

  // Admitting a person goes to a secret ballot: the log keeps each stance's
  // commitment and its actor, never the stance; a member reads their own
  // stance alone, and the tally is sealed until the close.
  assert.equal((await one<{ ballot: string }>('SELECT ballot FROM motion.motion WHERE id = $1', [admission])).ballot, 'secret')
  const logged = await all<{ actor: string; stance: Record<string, unknown> }>(
    `SELECT actor, form -> 'stance' AS stance FROM cella.log WHERE op = 'motion:motion:vote' AND form ->> 'motion' = $1`,
    [admission],
  )
  assert.equal(logged.length, 10)
  assert.ok(logged.every((l) => typeof l.stance === 'object' && '$commit' in l.stance), JSON.stringify(logged[0]))
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [camille])
  const read = (await app.query<{ member: string }>('SELECT member FROM motion.vote WHERE motion = $1', [admission])).rows
  assert.deepEqual(read, [{ member: camille }])
  const tally = (await app.query('SELECT passes, counted, given, quorate FROM membership_motion.tally($1)', [admission])).rows[0]
  assert.deepEqual(tally, { passes: null, counted: null, given: null, quorate: null })
  await app.query(`SELECT set_config('cella.actor', '', false)`)
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM motion.vote WHERE motion = $1', [admission])).n, '10')
})

test('the close admits Nadia and seats her in the assembly, an effect in its transaction, and her subscription an effect of the admission; she signs from the laptop she took up her invitation on', async () => {
  await on('2026-11-07')
  const before = await head()
  const outcome = await close({ motion: admission }, as(camille))
  settled(outcome)
  const [admitted] = done('motion:motion:close', outcome).then
  assert.deepEqual([admitted.op, admitted.state, admitted.then.map((d) => [d.op, d.state])], ['membership:member:admit', 'settled', [['account:capital:subscribe', 'settled']]])
  assert.equal(await head(), before + 3, 'the close and its effects, consecutive in the log')
  assert.deepEqual(
    await all<{ op: string; cause: string | null }>('SELECT op, cause FROM cella.log WHERE n > $1 ORDER BY n', [before]),
    [
      { op: 'motion:motion:close', cause: null },
      { op: 'membership:member:admit', cause: String(before + 1) },
      { op: 'account:capital:subscribe', cause: String(before + 2) },
    ],
  )
  assert.equal(await status(nadia), 'active')
  // Closed, the secret ballot's tally opens to every member.
  assert.deepEqual(
    (await app.query('SELECT passes, counted, given, quorate FROM membership_motion.tally($1)', [admission])).rows[0],
    { passes: true, counted: 10, given: 10, quorate: true },
  )
  assert.deepEqual(
    await one('SELECT circle, role, to_char(since, \'YYYY-MM-DD\') AS since FROM circle.seat WHERE member = $1', [nadia]),
    { circle: 'ag', role: 'member', since: '2026-11-07' },
  )
  assert.deepEqual(
    await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM person.device WHERE address = $1`, [nadia]),
    { label: 'laptop', enrolled: '2026-10-24' },
  )
  // A member, she invites by the member role's mandate; she is no
  // employee, so logging time is no right of hers.
  settled(await invite({ address: 'yara@lanterne.example', name: 'Yara Haddad', link: await sha256(random()) }, as(nadia)))
  assert.match(reason(await log({ member: nadia, day: '2026-11-07', minutes: 240, billable: true }, as(nadia))), /the actor holds no mandate for log-time/)
})

test('Chloé suspended by the assembly\'s motion: carried out in the close\'s transaction, her writes are refused', async () => {
  const proposed = settled(await put({ kind: 'suspend', args: { member: chloe }, deadline: '2026-11-14', body: '' }, as(camille)))
  await consented(proposed.motion)
  await on('2026-11-14')
  const outcome = await close({ motion: proposed.motion }, as(camille))
  settled(outcome)
  const then = done('motion:motion:close', outcome).then
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['membership:member:suspend', 'settled']])
  assert.equal(await status(chloe), 'suspended')

  const logged = await log({ member: chloe, day: '2026-11-14', minutes: 60, billable: false }, as(chloe))
  assert.equal(logged.state, 'refused')
  const open = settled(await put({ kind: 'seat', args: { circle: 'marketing', member: nadia }, deadline: '2026-11-21', body: '' }, as(malik)))
  const stance = await vote({ motion: open.motion, member: chloe, stance: 'object' }, as(chloe))
  assert.match(reason(stance), /chloe@lanterne\.example is (not on the roll|not an active member)/)
})

test('circles never nest: no circle has a parent, and a motion to nest one carries no action the co-op knows', async () => {
  const columns = await all<{ c: string }>(`SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'circle' AND table_name = 'circle'`)
  assert.equal(columns.some((r) => r.c === 'parent' || r.c === 'path'), false)
  assert.deepEqual(await all(`SELECT id FROM circle.circle WHERE assembly`), [{ id: 'ag' }])
  assert.equal((await all(`SELECT FROM motion.carries WHERE kind = 'nest'`)).length, 0)
  assert.equal((await all(`SELECT FROM circle.mandate WHERE power = 'nest-circle'`)).length, 0)
  await on('2026-11-14')
  // A nesting is no kind of action the motion feat knows, so the proposal
  // cannot even be written.
  await assert.rejects(
    proposeAlone(
      { circle: 'coordination', title: 'Nest Brand under Marketing', procedure: 'consent', deadline: '2026-11-21', body: '', actions: [{ kind: 'nest', args: { circle: 'brand', parent: 'marketing' } }] },
      as(hugo),
    ),
    /action_kind_fkey/,
  )
})

test('coordination grants the finance role send-quote by motion, under the send-quote the assembly grants it, a mandate policy of coordination\'s, copied into its mandate; Brand, first by id and holding adopt-policy alone, is passed over', async () => {
  // Coordination issues a mandate only under one it holds: the assembly
  // grants it send-quote first, and Brand adopt-policy and no send-quote.
  const issuing = settled(
    await propose(
      {
        circle: 'ag',
        title: 'Coordination grants the working circles send-quote, and Brand adopts policies',
        procedure: 'consent',
        deadline: '2026-11-28',
        body: '',
        actions: [
          { kind: 'policy', args: { kind: 'mandate', wording: 'The {circle: coordination} circle holds {power: send-quote}, to grant the working circles\' roles quotes, by motion, up to {limit: 15 000 €} a write' } },
          { kind: 'policy', args: { kind: 'mandate', wording: 'The {circle: brand} circle holds {power: adopt-policy}, to adopt policies, by motion' } },
        ],
      },
      as(camille),
    ),
  )
  // Chloé, suspended, gives no stance; consent passes with no objection.
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1 AND member <> $2', [issuing.motion, chloe])) {
    settled(await vote({ motion: issuing.motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-11-28')
  assert.deepEqual((await closing(issuing.motion)).map((d) => [d.op, d.state]), [
    ['motion:policy:adopt', 'settled'],
    ['motion:policy:adopt', 'settled'],
  ])
  // A grant wider than coordination's 15 000 € is coordination's to issue
  // under nothing, so it is the assembly's.
  const decider = async (grant: Record<string, unknown>) =>
    (await one<{ d: string }>(`SELECT motion.decider('operations', ARRAY['adopt-policy', 'send-quote'], '2026-11-28', $1) AS d`, [grant])).d
  assert.equal(await decider({ power: 'send-quote', limit: 2000000 }), 'ag')
  assert.equal(await decider({ power: 'send-quote', limit: 500000 }), 'coordination')
  const put: circleMotions.Put = { circle: 'operations', kind: 'grant', args: { role: 'finance', power: 'send-quote', text: 'send a quote', limit: 5000 }, deadline: '2026-12-05', body: '' }
  assert.equal((await circles.putting(put, app)).circle, 'coordination')
  const proposed = settled(await putCircle(put, as(camille)))
  for (const m of coordination) {
    settled(await vote({ motion: proposed.motion, member: m, stance: 'consent' }, as(m)))
  }
  await on('2026-12-05')
  assert.deepEqual((await closing(proposed.motion)).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  assert.equal(
    (await one<{ parent: string }>(`SELECT p.grantee AS parent FROM circle.mandate m JOIN circle.mandate p ON p.id = m.parent WHERE m.grantee = 'finance' AND m.power = 'send-quote'`)).parent,
    'coordination',
  )
  const granted = await one(
    `SELECT m.power, cella.cents(m."limit")::int AS "limit", to_char(m."from", 'YYYY-MM-DD') AS "from", r.circle, policy.sentence(w.legal) AS sentence
     FROM circle.mandate m JOIN policy.policy r ON r.id = m.policy JOIN policy.wording w ON w.policy = r.id
     WHERE m.grantee = 'finance' AND m.power = 'send-quote'`,
  )
  assert.deepEqual(granted, {
    power: 'send-quote',
    limit: 500000,
    from: '2026-12-05',
    circle: 'coordination',
    sentence: 'The finance role holds send-quote, to send a quote, up to 5 000 € a write',
  })
})

test('Hugo, Brand\'s lead, may not approve Thomas\'s time, which is Web\'s; Yusuf, Web\'s lead, may', async () => {
  await on('2026-11-02')
  settled(await log({ member: thomas, day: '2026-10-30', minutes: 420, billable: true, circle: 'web' }, as(thomas)))
  settled(await submit({ member: thomas, month: '2026-10', circle: 'web' }, as(thomas)))
  const astray = await approve({ member: thomas, month: '2026-10', circle: 'web' }, as(hugo))
  assert.match(reason(astray), /the actor holds approve-time by no mandate covering web's records/)
  settled(await approve({ member: thomas, month: '2026-10', circle: 'web' }, as(yusuf)))
})

test('Thomas\'s time for Brand in October is a month of its own: Web\'s approved takes no more Web time and Brand\'s stays open, which Yusuf is refused and Hugo approves', async () => {
  settled(await log({ member: thomas, day: '2026-10-29', minutes: 60, billable: false, circle: 'brand' }, as(thomas)))
  assert.deepEqual(await all(`SELECT circle, state, hours::float8 AS hours FROM timesheet.sheet WHERE member = $1 AND month = '2026-10' ORDER BY circle`, [thomas]), [
    { circle: 'brand', state: 'open', hours: 1 },
    { circle: 'web', state: 'approved', hours: (await one<{ h: number }>(`SELECT (sum(minutes) / 60.0)::float8 AS h FROM timesheet.entry WHERE member = $1 AND circle = 'web' AND to_char(day, 'YYYY-MM') = '2026-10'`, [thomas])).h },
  ])
  const late = await log({ member: thomas, day: '2026-10-29', minutes: 60, billable: true, circle: 'web' }, as(thomas))
  assert.match(reason(late), /thomas@lanterne\.example's 2026-10 in web was approved on 2026-11-02: it takes no new entries/)
  settled(await submit({ member: thomas, month: '2026-10', circle: 'brand' }, as(thomas)))
  const astray = await approve({ member: thomas, month: '2026-10', circle: 'brand' }, as(yusuf))
  assert.match(reason(astray), /the actor holds approve-time by no mandate covering brand's records/)
  settled(await approve({ member: thomas, month: '2026-10', circle: 'brand' }, as(hugo)))
})

test('Julien, seated in the assembly as treasurer, approves Amina\'s time, which is Web\'s', async () => {
  settled(await log({ member: amina, day: '2026-10-30', minutes: 300, billable: true, circle: 'web' }, as(amina)))
  settled(await submit({ member: amina, month: '2026-10', circle: 'web' }, as(amina)))
  settled(await approve({ member: amina, month: '2026-10', circle: 'web' }, as(julien)))
})

test('a grant no circle holds a mandate to issue under is put to the assembly: coordination and Brand, holding adopt-policy and no approve-expense, are passed over, and the assembly grants finance one as a root', async () => {
  await on('2026-12-01')
  const proposed = settled(
    await putCircle({ circle: 'operations', kind: 'grant', args: { role: 'finance', power: 'approve-expense', text: 'approve expenses', limit: 3000 }, deadline: '2026-12-08', body: '' }, as(camille)),
  )
  assert.equal((await one<{ circle: string }>('SELECT circle FROM motion.motion WHERE id = $1', [proposed.motion])).circle, 'ag')
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1 AND member <> $2', [proposed.motion, chloe])) {
    settled(await vote({ motion: proposed.motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-12-08')
  assert.deepEqual((await closing(proposed.motion)).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  assert.deepEqual(
    await one(`SELECT issuer, parent, cella.cents("limit")::int AS "limit" FROM circle.mandate WHERE grantee = 'finance' AND power = 'approve-expense'`),
    { issuer: 'ag', parent: null, limit: 300000 },
  )
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
