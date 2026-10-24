// The governance scenario, end to end on a seeded Lanterne, through the
// handlers: Malik invites a friend with her first device, the assembly
// admits her and the close seats her and enrols the device in the same
// verdict, or refuses all of it; a suspension by decision stops a
// member's writes; a nesting that would make a cycle is refused; a
// mandate is granted by decision, and one beyond what the circle above
// holds is refused; and a lead approves the time of their own circle
// alone, the treasurer everyone's. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { propose, vote } from '@cella/org-decision/api'
import { put as putCircle } from '@cella/org-graft-circle-decision/api'
import { carried, close, put } from '@cella/org-graft-circle-decision-member/api'
import { grant } from '@cella/org-circle/api'
import { invite } from '@cella/org-graft-key-member/api'
import { approve, log, submit } from '@cella/org-timesheet/api'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
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
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const status = async (m: string) => (await one<{ status: string }>('SELECT status FROM member.member WHERE address = $1', [m]))?.status

// Every member on a decision's roll consents.
async function consented(decision: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM circle_decision_member.roll WHERE decision = $1', [decision])) {
    settled(await vote({ decision, member, stance: 'consent' }, as(member)))
  }
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

let admission = ''

test('Malik invites Nadia with her laptop: the invitation carries its key, which no one can sign with yet', async () => {
  const laptop = await fixture(nadia, 'laptop')
  const invited = settled(await invite({ address: nadia, name: 'Nadia Benali', key: laptop.key, label: 'laptop' }, as(malik)))
  assert.deepEqual(invited, { member: nadia, invited: '2026-10-24', key: laptop.key })
  assert.equal(await status(nadia), 'invited')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM key.device WHERE address = $1', [nadia])).n, '0')

  await assert.rejects(invite({ address: 'sam@lanterne.example', name: 'Sam', key: laptop.key, label: 'phone' }, as(malik)), /another invitation carries this device key/)
})

test('only the assembly admits: coordination may not; Malik proposes Nadia\'s admission to the assembly', async () => {
  const astray = await propose(
    { circle: 'coordination', title: 'Admit Nadia', rule: 'consent', deadline: '2026-11-07', body: '', motions: [{ kind: 'admit', args: { member: nadia, shares: 10 } }] },
    as(camille),
  )
  assert.match(reason(astray), /only the assembly decides to admit a member, not coordination/)

  const proposed = settled(await put({ kind: 'admit', args: { member: nadia, shares: 10 }, deadline: '2026-11-07', body: 'Nadia has worked with marketing since spring.' }, as(malik)))
  admission = proposed.decision
  assert.equal(admission, 'd-2026-013')
  const d = await one<{ circle: string; title: string; roll: string }>(
    `SELECT circle, title, (SELECT count(*) FROM circle_decision_member.roll r WHERE r.decision = d.id) AS roll FROM decision.decision d WHERE id = $1`,
    [admission],
  )
  assert.deepEqual(d, { circle: 'ag', title: 'Admit Nadia Benali as a member', roll: '10' })
  await consented(admission)
})

test('a close whose seat is refused refuses the whole close: no admission, no device, no verdict', async () => {
  await on('2026-11-07')
  await su.query(`INSERT INTO circle_member.position (circle, member, role, since) VALUES ('ag', $1, 'member', '2026-11-01')`, [nadia])
  const before = await head()
  const refused = await close({ decision: admission }, as(camille))
  assert.match(reason(refused), /nadia@lanterne\.example already sits in ag as member/)
  assert.equal(await head(), before)
  assert.equal(await status(nadia), 'invited')
  assert.equal((await one<{ closed: string | null }>('SELECT closed FROM decision.decision WHERE id = $1', [admission])).closed, null)
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM key.device WHERE address = $1', [nadia])).n, '0')
  await su.query(`DELETE FROM circle_member.position WHERE member = $1`, [nadia])
})

test('the close admits Nadia, seats her in the assembly and enrols her laptop, in one verdict; she signs from it', async () => {
  const before = await head()
  const closed = settled(await close({ decision: admission }, as(camille)))
  assert.deepEqual(closed.admitted.map((a) => [a.member, a.shares]), [[nadia, 10]])
  assert.equal(await head(), before + 1, 'one log entry')
  assert.equal(await status(nadia), 'active')
  assert.deepEqual(
    await one('SELECT circle, role, to_char(since, \'YYYY-MM-DD\') AS since FROM circle_member.position WHERE member = $1', [nadia]),
    { circle: 'ag', role: 'member', since: '2026-11-07' },
  )
  assert.deepEqual(
    await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM key.device WHERE address = $1`, [nadia]),
    { label: 'laptop', enrolled: '2026-11-07' },
  )
  settled(await log({ member: nadia, day: '2026-11-07', minutes: 240, billable: true }, as(nadia)))
})

test('Chloé suspended by the assembly\'s decision: carried out after the close, her writes are refused', async () => {
  const proposed = settled(await put({ kind: 'suspend', args: { member: chloe }, deadline: '2026-11-14', body: '' }, as(camille)))
  await consented(proposed.decision)
  await on('2026-11-14')
  settled(await close({ decision: proposed.decision }, as(camille)))
  const then = await carried(proposed.decision, as(camille))
  assert.deepEqual(then.map((d) => [d.op, d.state]), [['member:member:suspend', 'settled']])
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
