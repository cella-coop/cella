// A motion's requirements are the procedures on its mandate's chain, end
// to end on a seeded Lanterne, through the handlers: the assembly adopts
// a procedure that consults coordination, and coordination grants Web
// adopt-policy under its own, by that procedure; a motion of Web adopting
// a rule is decided by it whatever its proposal names, and its close is
// refused until someone of coordination has spoken on it, a word from
// Web's own counting for nothing; and a mandate issued under a chain
// asking two thirds may ask no looser procedure, while one asking none
// is decided by the chain's. Run by `cella test e2e requirements`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { post, vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')

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

type Action = { kind: string; args: Record<string, string> }

// A motion of `circle` carrying its actions, proposed by `by`, consented
// to by everyone on its roll; returns it.
async function consented(circle: string, title: string, actions: Action[], by: string, from: string, deadline: string) {
  await on(from)
  const { motion } = settled(await propose({ circle, title, procedure: 'consent', deadline, body: '', actions }, as(by)))
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  return motion
}

// The same, closed on its deadline and carried out; returns what was carried.
async function decided(circle: string, title: string, actions: Action[], from: string, deadline: string) {
  const motion = await consented(circle, title, actions, camille, from, deadline)
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return carried(motion, as(camille))
}

const heard = {
  kind: 'policy',
  args: {
    kind: 'procedure',
    wording: 'By {procedure: heard}, a motion is decided by {method: consent}, with a quorum of {quorum: none}, once the {consult: coordination} circle is heard',
  },
}

const webPolicies = {
  kind: 'policy',
  args: {
    kind: 'mandate',
    wording: 'The {circle: web} circle holds {power: adopt-policy}, to adopt its own policies, by motion, by {procedure: heard}',
  },
}

const expenses = (grantee: string, procedure?: string) => ({
  kind: 'policy',
  args: {
    kind: 'mandate',
    wording: `The {${grantee === 'coordination' ? 'circle' : 'role'}: ${grantee}} ${grantee === 'coordination' ? 'circle' : 'role'} holds {power: approve-expense}, to approve what Web's members spend${procedure ? `, by {procedure: ${procedure}}` : ''}`,
  },
})

let webMotion = ''
let webber = ''

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

test('coordination grants Web adopt-policy under its own, by a procedure the assembly adopted that consults coordination', async () => {
  const adopted = await decided('ag', 'A procedure that hears coordination', [heard], '2026-11-02', '2026-11-09')
  assert.deepEqual(adopted.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.deepEqual(await one(`SELECT method, motion.consults(id) AS consult FROM motion.procedure WHERE id = 'heard'`), { method: 'consent', consult: 'coordination' })
  const granted = await decided('coordination', 'Web adopts its own policies', [webPolicies], '2026-11-09', '2026-11-16')
  assert.deepEqual(granted.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.deepEqual(
    await one(
      `SELECT m.issuer, p.grantee AS parent, m.procedure, motion.asks_of(m.id) AS asks
       FROM circle.mandate m JOIN circle.mandate p ON p.id = m.parent WHERE m.grantee = 'web' AND m.power = 'adopt-policy'`,
    ),
    { issuer: 'coordination', parent: 'coordination', procedure: 'heard', asks: 'heard' },
  )
})

test('a motion of Web is decided by what its mandate\'s chain asks, whatever its proposal names', async () => {
  webber = (await one<{ member: string }>(
    `SELECT s AS member FROM circle.seated('web', '2026-11-16') s
     WHERE s NOT IN (SELECT circle.seated('coordination', '2026-11-16')) ORDER BY s LIMIT 1`,
  )).member
  const rule = { kind: 'policy', args: { kind: 'rule', wording: 'Web reviews every change before it ships' } }
  webMotion = await consented('web', 'Every change is reviewed', [rule], webber, '2026-11-16', '2026-11-23')
  assert.deepEqual(await one('SELECT procedure, method FROM motion.motion WHERE id = $1', [webMotion]), { procedure: 'heard', method: 'consent' })
  // A text alone acts under no mandate, so Web's own procedure decides it.
  const { motion } = settled(await propose({ circle: 'web', title: 'A standing desk', procedure: 'majority', deadline: '2026-11-23', body: '', actions: [] }, as(webber)))
  assert.deepEqual(await one('SELECT procedure FROM motion.motion WHERE id = $1', [motion]), { procedure: 'consent' })
})

test('its close is refused until someone of coordination has spoken on it; a word from Web counts for nothing', async () => {
  await on('2026-11-23')
  settled(await post({ motion: webMotion, member: webber, reply: null, body: 'All of us agree.' }, as(webber)))
  const early = await close({ motion: webMotion }, as(webber))
  assert.match(reason(early), new RegExp(`${webMotion} is decided by heard, which consults coordination: it closes once someone seated in coordination has said something on it`))
  assert.ok(!(await all<{ s: string }>(`SELECT s FROM circle.seated('web', '2026-11-23') s`)).some((r) => r.s === camille))
  settled(await post({ motion: webMotion, member: camille, reply: null, body: 'Coordination is glad of it.' }, as(camille)))
  settled(await close({ motion: webMotion }, as(webber)))
  const out = await carried(webMotion, as(webber))
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
})

test('a mandate issued under a chain asking two thirds asks none looser; one asking none is decided by the chain\'s', async () => {
  const granted = await decided('ag', 'Coordination approves Web\'s expenses', [expenses('coordination', 'two-thirds')], '2026-11-23', '2026-11-30')
  assert.deepEqual(granted.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  const out = await decided(
    'coordination',
    'Web\'s lead approves its expenses',
    [expenses('web-lead', 'majority'), expenses('web-lead', 'consent'), expenses('web-lead')],
    '2026-11-30',
    '2026-12-07',
  )
  assert.deepEqual(out.map((d) => [d.op, d.state]), [
    ['motion:policy:adopt', 'refused'],
    ['motion:policy:adopt', 'refused'],
    ['motion:policy:adopt', 'settled'],
  ])
  assert.match(out[0].reason ?? '', /asks majority, looser than two-thirds, which the chain of mandate \d+ it is issued under asks/)
  assert.match(out[1].reason ?? '', /asks consent, looser than two-thirds/)
  const { id } = await one<{ id: string }>(`SELECT id FROM circle.mandate WHERE grantee = 'web-lead' AND power = 'approve-expense' AND revoked IS NULL`)
  assert.deepEqual(await one('SELECT motion.asks_of($1) AS asks', [id]), { asks: 'two-thirds' })
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
