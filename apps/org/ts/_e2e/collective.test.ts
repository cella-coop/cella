// Collective mandates, end to end on a seeded Lanterne, through the
// handlers: a circle holds a mandate as a whole and uses it only by
// motion. The founding motion grants the assembly's and coordination's,
// and no working circle's; the assembly's m-2026-012 admits Inès under its
// `admit-member`, while the same admission put in Web is refused at its
// proposal; the assembly ends coordination's `nest-circle`, and
// coordination's next nesting is refused; and a collective mandate beyond
// what the circle above holds is refused as it is adopted, by
// `circle.carves`. Run by `cella test e2e collective`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-circle-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

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

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
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
    `SELECT m.circle, array_agg(m.power ORDER BY m.power) AS powers
     FROM circle.mandate m JOIN policy.policy r ON r.id = m.policy
     WHERE m.circle IS NOT NULL AND m.role IS NULL AND r.motion = 'm-2021-001' AND m.revoked IS NULL
     GROUP BY m.circle ORDER BY m.circle`,
  )
  assert.deepEqual(held, [
    {
      circle: 'ag',
      powers: ['admit-member', 'adopt-document', 'adopt-policy', 'approve-distribution', 'end-policy', 'exclude-member', 'nest-circle', 'seat-member', 'suspend-member'],
    },
    { circle: 'coordination', powers: ['adopt-document', 'adopt-policy', 'end-policy', 'nest-circle', 'seat-member'] },
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
  const done = settled(await close({ motion: 'm-2026-012' }, as(camille)))
  assert.deepEqual(done.admitted.map((a) => a.member), [ines])
  assert.deepEqual(await one(`SELECT status FROM membership.member WHERE address = $1`, [ines]), { status: 'active' })
})

test('the assembly ends coordination\'s nest-circle, and coordination\'s next nesting is refused at its proposal', async () => {
  await on('2026-11-01')
  const nesting = { kind: 'nest', args: { circle: 'brand', parent: 'web' } }
  const before = await propose({ circle: 'coordination', title: 'Brand works under Web', procedure: 'consent', deadline: '2026-11-15', body: '', actions: [nesting] }, as(camille))
  assert.equal(before.state, 'settled', reason(before))
  const nests = (await one<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE circle = 'coordination' AND power = 'nest-circle'`)).policy
  const { out } = await decided('Coordination nests no circle', [{ kind: 'end', args: { policy: nests } }], '2026-11-01', '2026-11-15')
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  assert.equal(await holds('coordination', 'nest-circle', '2026-11-14'), true)
  assert.equal(await holds('coordination', 'nest-circle', '2026-11-15'), false)
  const after = await propose({ circle: 'coordination', title: 'Brand works under Web', procedure: 'consent', deadline: '2026-11-29', body: '', actions: [nesting] }, as(camille))
  assert.match(reason(after), /coordination holds no collective mandate for nest-circle, so its motion may not nest a circle/)
})

test('a collective mandate beyond what the circle above holds is refused as it is adopted: Web may not set budgets of 20 000 € under coordination\'s 10 000 €', async () => {
  const { out } = await decided(
    'Coordination and Web set budgets by motion',
    [
      { kind: 'policy', args: { kind: 'mandate', wording: 'The {circle: coordination} circle holds {power: set-budget}, to set a project\'s budget by motion, up to {limit: 10 000 €} a write' } },
      { kind: 'policy', args: { kind: 'mandate', wording: 'The {circle: web} circle holds {power: set-budget}, to set a project\'s budget by motion, up to {limit: 20 000 €} a write' } },
    ],
    '2026-11-15',
    '2026-11-29',
  )
  assert.deepEqual(out.map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled'], ['motion:policy:adopt', 'refused']])
  assert.match(out[1].reason ?? '', /grants set-budget to web beyond what coordination holds of it/)
  assert.deepEqual(await all(`SELECT circle, cella.cents("limit")::int AS "limit" FROM circle.mandate WHERE power = 'set-budget' AND circle IS NOT NULL`), [
    { circle: 'coordination', limit: 1000000 },
  ])
})
