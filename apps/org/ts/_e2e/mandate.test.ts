// A mandate is a policy, end to end on a seeded Lanterne, through the
// handlers: Lanterne's mandates are policies of the assembly, adopted by
// its founding motion; Julien pays a supplier 2 900 € and is refused
// 3 100 €; the assembly adopts a mandate of 4 000 € a payment, its values
// copied into his role's mandate, and 3 100 € passes; ending the policy
// revokes it, and the next 3 100 € is refused; a mandate policy marking no
// role is refused at its proposal, and one beyond what the circle above
// holds is refused as it is adopted. Run by `cella test e2e mandate`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-circle-membership-motion/api'
import { pay } from '@cella/org-transaction/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const julien = at('julien')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)
const raised = 'The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: 4 000 €} a write'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const paying = (date: string, euros: number) => pay({ date, label: 'Imprimerie du Parc: posters', cents: euros * 100 }, as(julien))

// A motion of the assembly carrying one action, passed by consent and
// carried out on its deadline; returns the motion and what was carried.
async function decided(title: string, action: { kind: string; args: Record<string, string> }, from: string, deadline: string) {
  await on(from)
  const { motion } = settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline, body: '', actions: [action] }, as(camille)))
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return { motion, out: await carried(motion, as(camille)) }
}

before(async () => {
  await su.connect()
})

after(async () => {
  await app.end()
  await su.end()
})

test('Lanterne\'s mandates are policies of the assembly, adopted by its founding motion', async () => {
  assert.deepEqual(
    await one(
      `SELECT count(*)::int AS mandates, count(*) FILTER (WHERE r.kind = 'mandate' AND r.circle = 'ag' AND r.motion = 'm-2021-001')::int AS adopted
       FROM circle.mandate m JOIN policy.policy r ON r.id = m.policy`,
    ),
    { mandates: 65, adopted: 65 },
  )
  assert.deepEqual(
    await one(
      `SELECT m.policy, cella.cents(m."limit")::int AS "limit", to_char(m."from", 'YYYY-MM-DD') AS "from", policy.sentence(w.legal) AS sentence
       FROM circle.mandate m JOIN policy.wording w ON w.policy = m.policy WHERE m.role = 'finance' AND m.power = 'pay-supplier'`,
    ),
    { policy: 'm-2021-001/15', limit: 300000, from: '2021-03-01', sentence: 'The finance role holds pay-supplier, to pay suppliers, up to 3 000 € a write' },
  )
})

test('Julien pays a supplier 2 900 € within his 3 000 €, and is refused 3 100 €', async () => {
  await on('2026-11-07')
  settled(await paying('2026-11-07', 2900))
  assert.match(reason(await paying('2026-11-07', 3100)), /julien@lanterne\.example holds no mandate for pay-supplier up to 3100\.00 €/)
})

let raising = ''

test('the assembly adopts a mandate of 4 000 € a payment, copied into finance\'s mandates, and 3 100 € passes', async () => {
  const { motion, out } = await decided('Finance pays suppliers up to 4 000 €', { kind: 'policy', args: { kind: 'mandate', wording: raised, friendly: 'Finance may pay suppliers up to 4 000 € a payment.' } }, '2026-11-07', '2026-11-21')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  raising = `${motion}/1`
  assert.deepEqual(
    await one(
      `SELECT role, power, cella.cents("limit")::int AS "limit", to_char("from", 'YYYY-MM-DD') AS "from", revoked FROM circle.mandate WHERE policy = $1`,
      [raising],
    ),
    { role: 'finance', power: 'pay-supplier', limit: 400000, from: '2026-11-21', revoked: null },
  )
  settled(await paying('2026-11-21', 3100))
})

test('ending the policy revokes its mandate, and the next 3 100 € is refused', async () => {
  const { motion, out } = await decided('Finance pays suppliers up to 3 000 € again', { kind: 'end', args: { policy: raising } }, '2026-11-21', '2026-12-05')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  assert.deepEqual(
    await one(
      `SELECT to_char(r.ends, 'YYYY-MM-DD') AS ends, r.ended_by, to_char(m.revoked, 'YYYY-MM-DD') AS revoked
       FROM policy.policy r JOIN circle.mandate m ON m.policy = r.id WHERE r.id = $1`,
      [raising],
    ),
    { ends: '2026-12-05', ended_by: `${motion}/1`, revoked: '2026-12-05' },
  )
  assert.match(reason(await paying('2026-12-05', 3100)), /julien@lanterne\.example holds no mandate for pay-supplier up to 3100\.00 €/)
  settled(await paying('2026-12-05', 2900))
})

test('a mandate policy marking no role is refused at its proposal', async () => {
  await on('2026-12-05')
  const unmarked = await propose(
    {
      circle: 'ag',
      title: 'Finance pays suppliers',
      procedure: 'consent',
      deadline: '2026-12-19',
      body: '',
      actions: [{ kind: 'policy', args: { kind: 'mandate', wording: 'Finance holds {power: pay-supplier}' } }],
    },
    as(camille),
  )
  assert.match(reason(unmarked), /a mandate policy names its role, as \{role: finance\}/)
})

test('a mandate policy beyond what the circle above holds is refused as it is adopted: finance may not approve 3 000 € of expenses, beyond the gérante\'s 2 000 €', async () => {
  const beyond = 'The {role: finance} role holds {power: approve-expense}, to approve expenses, up to {limit: 3 000 €} a write'
  const { motion, out } = await decided('Finance approves expenses', { kind: 'policy', args: { kind: 'mandate', wording: beyond } }, '2026-12-05', '2026-12-19')
  assert.deepEqual(out.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'refused']])
  assert.match(out[0].reason ?? '', /grants approve-expense to finance beyond what ag holds of it/)
  assert.equal((await one<{ n: number }>('SELECT count(*)::int AS n FROM policy.policy WHERE motion = $1', [motion])).n, 0)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
