// The governance scenario, end to end on a seeded Lanterne, through the
// handlers: Malik invites a friend by a link, which she takes up on her
// laptop, enrolling it; the assembly admits her and the close seats her
// in the same verdict, or refuses all of it; a suspension by decision stops a
// member's writes; a nesting that would make a cycle is refused; a
// mandate is granted by decision, and one beyond what the circle above
// holds is refused; and a lead approves the time of their own circle
// alone, the treasurer everyone's. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { propose as proposeAlone, vote } from '@cella/org-decision/api'
import { putting } from '@cella/org-graft-circle-decision/api'
import type { Motion } from '@cella/org-graft-circle-decision/models'
import { carried, close, propose, put } from '@cella/org-graft-circle-decision-membership/api'
import { grant } from '@cella/org-circle/api'
import { accept, invite, link as link_ } from '@cella/org-membership/api'
import { approve, log, submit } from '@cella/org-timesheet/api'
import type { Deps } from '@cella/org-db'
import { fixture, random, sha256, signer } from '@cella/org-sign'
import { scope, sign } from './lanterne.ts'

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
  actor === nadia ? { db: app, actor, sign: signer(scope, nadia, fixture(nadia, 'laptop')) } : { db: app, actor, sign: sign(actor) }
// What a circle's page proposes about it, put as the shell puts it.
const putCircle = async (m: Motion, deps: Deps) => propose(await putting(m, deps.db), deps)
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const status = async (m: string) => (await one<{ status: string }>('SELECT status FROM membership.member WHERE address = $1', [m]))?.status

// Every member on a decision's roll consents.
async function consented(decision: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM circle_decision_membership.roll WHERE decision = $1', [decision])) {
    settled(await vote({ decision, member, stance: 'consent' }, as(member)))
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

test('only the assembly admits: coordination may not; Malik proposes Nadia\'s admission to the assembly', async () => {
  const astray = await propose(
    { circle: 'coordination', title: 'Admit Nadia', procedure: 'consent', deadline: '2026-11-07', body: '', motions: [{ kind: 'admit', args: { member: nadia, shares: 20 } }] },
    as(camille),
  )
  assert.match(reason(astray), /only the assembly decides to admit a member, not coordination/)
  // The decision feat's proposal alone fixes no roll, and is refused.
  const alone = await proposeAlone(
    { circle: 'ag', title: 'Admit Nadia', procedure: 'consent', deadline: '2026-11-07', body: '', motions: [{ kind: 'admit', args: { member: nadia, shares: 20 } }] },
    as(malik),
  )
  assert.match(reason(alone), /'s proposal did not fix its roll: its roll is those seated in ag on the day it is proposed/)

  const proposed = settled(await put({ kind: 'admit', args: { member: nadia, shares: 20 }, deadline: '2026-11-07', body: 'Nadia has worked with marketing since spring.' }, as(malik)))
  admission = proposed.decision
  assert.equal(admission, 'd-2026-013')
  const d = await one<{ circle: string; title: string; roll: string }>(
    `SELECT circle, title, (SELECT count(*) FROM circle_decision_membership.roll r WHERE r.decision = d.id) AS roll FROM decision.decision d WHERE id = $1`,
    [admission],
  )
  assert.deepEqual(d, { circle: 'ag', title: 'Admit Nadia Benali as a member', roll: '10' })
  await consented(admission)

  // Admitting a person goes to a secret ballot: the log keeps each stance's
  // commitment and its actor, never the stance; a member reads their own
  // stance alone, and the tally is sealed until the close.
  assert.equal((await one<{ ballot: string }>('SELECT ballot FROM decision.decision WHERE id = $1', [admission])).ballot, 'secret')
  const logged = await all<{ actor: string; stance: Record<string, unknown> }>(
    `SELECT actor, form -> 'stance' AS stance FROM cella.log WHERE op = 'decision:decision:vote' AND form ->> 'decision' = $1`,
    [admission],
  )
  assert.equal(logged.length, 10)
  assert.ok(logged.every((l) => typeof l.stance === 'object' && '$commit' in l.stance), JSON.stringify(logged[0]))
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [camille])
  const read = (await app.query<{ member: string }>('SELECT member FROM decision.vote WHERE decision = $1', [admission])).rows
  assert.deepEqual(read, [{ member: camille }])
  const tally = (await app.query('SELECT passes, counted, given, quorate FROM circle_decision_membership.tally($1)', [admission])).rows[0]
  assert.deepEqual(tally, { passes: null, counted: null, given: null, quorate: null })
  await app.query(`SELECT set_config('cella.actor', '', false)`)
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM decision.vote WHERE decision = $1', [admission])).n, '10')
})

test('a close whose seat is refused refuses the whole close: no admission, no device, no verdict', async () => {
  await on('2026-11-07')
  await su.query(`INSERT INTO circle_membership.position (circle, member, role, since) VALUES ('ag', $1, 'member', '2026-11-01')`, [nadia])
  const before = await head()
  const refused = await close({ decision: admission }, as(camille))
  assert.match(reason(refused), /nadia@lanterne\.example already sits in ag as member/)
  assert.equal(await head(), before)
  assert.equal(await status(nadia), 'invited')
  assert.equal((await one<{ closed: string | null }>('SELECT closed FROM decision.decision WHERE id = $1', [admission])).closed, null)
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM person.device WHERE address = $1', [nadia])).n, '1', 'her laptop, enrolled when she took up the invitation, is all she holds')
  await su.query(`DELETE FROM circle_membership.position WHERE member = $1`, [nadia])
})

test('the close admits Nadia and seats her in the assembly, in one verdict; she signs from the laptop she took up her invitation on', async () => {
  const before = await head()
  const closed = settled(await close({ decision: admission }, as(camille)))
  assert.deepEqual(closed.admitted.map((a) => [a.member, a.shares]), [[nadia, 20]])
  assert.equal(await head(), before + 1, 'one log entry')
  assert.equal(await status(nadia), 'active')
  // Closed, the secret ballot's tally opens to every member.
  assert.deepEqual(
    (await app.query('SELECT passes, counted, given, quorate FROM circle_decision_membership.tally($1)', [admission])).rows[0],
    { passes: true, counted: 10, given: 10, quorate: true },
  )
  assert.deepEqual(
    await one('SELECT circle, role, to_char(since, \'YYYY-MM-DD\') AS since FROM circle_membership.position WHERE member = $1', [nadia]),
    { circle: 'ag', role: 'member', since: '2026-11-07' },
  )
  assert.deepEqual(
    await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM person.device WHERE address = $1`, [nadia]),
    { label: 'laptop', enrolled: '2026-10-24' },
  )
  settled(await log({ member: nadia, day: '2026-11-07', minutes: 240, billable: true }, as(nadia)))
})

test('Chloé suspended by the assembly\'s decision: carried out after the close, her writes are refused', async () => {
  const proposed = settled(await put({ kind: 'suspend', args: { member: chloe }, deadline: '2026-11-14', body: '' }, as(camille)))
  await consented(proposed.decision)
  await on('2026-11-14')
  settled(await close({ decision: proposed.decision }, as(camille)))
  const then = await carried(proposed.decision, as(camille))
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['membership:member:suspend', 'settled']])
  assert.equal(await status(chloe), 'suspended')

  const logged = await log({ member: chloe, day: '2026-11-14', minutes: 60, billable: false }, as(chloe))
  assert.equal(logged.state, 'refused')
  const open = settled(await put({ kind: 'seat', args: { circle: 'marketing', member: nadia }, deadline: '2026-11-21', body: '' }, as(malik)))
  const stance = await vote({ decision: open.decision, member: chloe, stance: 'object' }, as(chloe))
  assert.match(reason(stance), /chloe@lanterne\.example is (not on the roll|not an active member)/)
})

test('nesting Brand under Marketing settles; Marketing under Brand then makes a cycle and is refused', async () => {
  await on('2026-11-14')
  const one_ = settled(await putCircle({ circle: 'brand', kind: 'nest', args: { parent: 'marketing' }, deadline: '2026-11-21', body: '' }, as(hugo)))
  const two = settled(await putCircle({ circle: 'marketing', kind: 'nest', args: { parent: 'brand' }, deadline: '2026-11-21', body: '' }, as(malik)))
  for (const d of [one_.decision, two.decision]) {
    assert.equal((await one<{ circle: string }>('SELECT circle FROM decision.decision WHERE id = $1', [d])).circle, 'coordination')
    for (const m of coordination) {
      settled(await vote({ decision: d, member: m, stance: 'consent' }, as(m)))
    }
  }
  await on('2026-11-21')
  settled(await close({ decision: one_.decision }, as(hugo)))
  assert.deepEqual((await carried(one_.decision, as(hugo))).map((d) => [d.op, d.state]), [['circle:circle:nest', 'settled']])
  assert.deepEqual((await one<{ path: string[] }>(`SELECT path FROM circle.circle WHERE id = 'brand'`)).path, ['ag', 'coordination', 'marketing', 'brand'])

  settled(await close({ decision: two.decision }, as(malik)))
  const cycle = await carried(two.decision, as(malik))
  assert.deepEqual(cycle.map((d) => [d.op, d.state]), [['circle:circle:nest', 'refused']])
  assert.match(cycle[0].reason ?? '', /brand is within marketing: nesting it there makes a cycle/)
  assert.equal((await one<{ parent: string }>(`SELECT parent FROM circle.circle WHERE id = 'marketing'`)).parent, 'coordination')
})

test('coordination grants the finance role send-quote by decision; a grant citing a decision that does not grant it is refused', async () => {
  const proposed = settled(
    await putCircle({ circle: 'operations', kind: 'grant', args: { role: 'finance', power: 'send-quote', text: 'send a quote', limit: 5000 }, deadline: '2026-11-28', body: '' }, as(camille)),
  )
  for (const m of coordination) {
    settled(await vote({ decision: proposed.decision, member: m, stance: 'consent' }, as(m)))
  }
  await on('2026-11-28')
  settled(await close({ decision: proposed.decision }, as(camille)))
  assert.deepEqual((await carried(proposed.decision, as(camille))).map((d) => [d.op, d.state]), [['circle:mandate:grant', 'settled']])
  const granted = await one(
    `SELECT power, cella.cents("limit")::int AS "limit", to_char("from", 'YYYY-MM-DD') AS "from" FROM circle.mandate WHERE role = 'finance' AND power = 'send-quote'`,
  )
  assert.deepEqual(granted, { power: 'send-quote', limit: 500000, from: '2026-11-28' })

  const astray = await grant({ role: 'finance', power: 'sign-lease', text: 'sign leases', decision: proposed.decision }, as(camille))
  assert.match(reason(astray), /does not grant sign-lease to finance so capped/)
})

test('Hugo, Brand\'s lead, may not approve Thomas\'s time, which is Web\'s; Yusuf, Web\'s lead, may', async () => {
  await on('2026-11-02')
  settled(await log({ member: thomas, day: '2026-10-30', minutes: 420, billable: true }, as(thomas)))
  settled(await submit({ member: thomas, month: '2026-10' }, as(thomas)))
  const astray = await approve({ member: thomas, month: '2026-10' }, as(hugo))
  assert.match(reason(astray), /hugo@lanterne\.example holds approve-time over no circle thomas@lanterne\.example sits in/)
  settled(await approve({ member: thomas, month: '2026-10' }, as(yusuf)))
})

test('Julien, seated in the assembly as treasurer, approves Amina\'s time, which is Web\'s', async () => {
  settled(await log({ member: amina, day: '2026-10-30', minutes: 300, billable: true }, as(amina)))
  settled(await submit({ member: amina, month: '2026-10' }, as(amina)))
  settled(await approve({ member: amina, month: '2026-10' }, as(julien)))
})

test('a mandate beyond what the circle above holds is refused: finance may not approve expenses beyond the gérante\'s 2 000 €', async () => {
  await on('2026-12-01')
  const proposed = settled(
    await putCircle({ circle: 'operations', kind: 'grant', args: { role: 'finance', power: 'approve-expense', text: 'approve expenses', limit: 3000 }, deadline: '2026-12-08', body: '' }, as(camille)),
  )
  for (const m of coordination) {
    settled(await vote({ decision: proposed.decision, member: m, stance: 'consent' }, as(m)))
  }
  await on('2026-12-08')
  settled(await close({ decision: proposed.decision }, as(camille)))
  const out = await carried(proposed.decision, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state]), [['circle:mandate:grant', 'refused']])
  assert.match(out[0].reason ?? '', /grants approve-expense to finance beyond what ag holds of it/)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
