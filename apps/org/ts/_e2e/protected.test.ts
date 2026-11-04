// A protected policy changes only by the stricter procedure it names, end
// to end on a seeded Lanterne, through the handlers: its rights, and the
// collective mandates that hand out mandates, are protected by the
// extraordinary assembly's procedure; a motion ending the members' right
// to draw on their account is decided by it whatever its proposal names,
// and passed by it ends the right, which is revoked; and a policy naming a
// procedure looser than its own motion's is refused. Run by `cella test
// e2e protected`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { propose as proposeAlone, vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
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

// The policy granting the members their right to draw on their account.
const drawing = async () =>
  (await one<{ policy: string }>(`SELECT policy FROM circle.right WHERE "right" = 'member' AND power = 'draw-account'`)).policy

before(async () => {
  await su.connect()
  await on('2026-11-07')
})

after(async () => {
  await app.end()
  await su.end()
})

test('Lanterne\'s rights and the mandates that hand out mandates are protected by the extraordinary assembly', async () => {
  const protectedBy = await all<{ id: string; protected: string; held: string }>(
    `SELECT r.id, r.protected, coalesce('right ' || g."right", m.grantee || ' ' || m.power) AS held
     FROM policy.policy r LEFT JOIN circle.mandate m ON m.policy = r.id LEFT JOIN circle.right g ON g.policy = r.id
     WHERE r.protected IS NOT NULL ORDER BY r.n`,
  )
  assert.equal(protectedBy.length, 22)
  assert.ok(protectedBy.every((p) => p.protected === 'extraordinary'))
  assert.deepEqual(
    protectedBy.filter((p) => !p.held.startsWith('right ')).map((p) => p.held),
    ['ag adopt-policy', 'ag end-policy', 'ag seat-member', 'coordination adopt-policy', 'coordination end-policy', 'coordination seat-member'],
  )
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM circle.right`)).n, 16)
})

let ending = ''

test('a motion of the assembly ending the members\' right to draw is decided by the extraordinary assembly\'s procedure, whatever its proposal names', async () => {
  const policy = await drawing()
  const named = { circle: 'ag', title: 'End the members\' draws', procedure: 'ordinary', deadline: '2026-11-21', actions: [{ kind: 'end', args: { policy } }] }
  ending = settled(await propose({ ...named, body: 'Draws on capital accounts stop; members are repaid as the statutes say.' }, as(camille))).motion
  assert.deepEqual(await one('SELECT procedure, method FROM motion.motion WHERE id = $1', [ending]), { procedure: 'extraordinary', method: 'majority' })
  // Put to the ordinary assembly by the motion feat alone, it is refused.
  const alone = await proposeAlone({ ...named, body: '' }, as(camille))
  assert.equal(alone.state, 'refused')
})

test('a policy naming a procedure looser than its own motion\'s is refused', async () => {
  // Replacing a right protected by the extraordinary assembly, the motion is decided by it.
  const { policy } = await one<{ policy: string }>(`SELECT policy FROM circle.right WHERE power = 'mark-read'`)
  const out = await propose(
    {
      circle: 'ag',
      title: 'Members read the internal rules',
      deadline: '2026-11-21',
      body: '',
      actions: [
        {
          kind: 'policy',
          args: { kind: 'right', wording: 'Every {right: member} holds {power: mark-read}, to mark a text read', replaces: policy, protected: 'ordinary' },
        },
      ],
    },
    as(camille),
  )
  assert.match(reason(out), /ordinary is looser than extraordinary, by which m-2026-\d+ is decided/)
})

test('passed by the extraordinary assembly\'s procedure, the motion ends the right, and it is revoked', async () => {
  const policy = await drawing()
  const motion = ending
  for (const [i, member] of assembly.entries()) {
    settled(await vote({ motion, member, stance: i < 8 ? 'for' : 'against' }, as(member)))
  }
  await on('2026-11-21')
  settled(await close({ motion }, as(camille)))
  const out = await carried(motion, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:end', 'settled', '']])
  assert.deepEqual(await one(`SELECT to_char(ends, 'YYYY-MM-DD') AS ends, ended_by FROM policy.policy WHERE id = $1`, [policy]), {
    ends: '2026-11-21',
    ended_by: `${motion}/1`,
  })
  assert.equal((await one<{ revoked: boolean }>(`SELECT revoked IS NOT NULL AS revoked FROM circle.right WHERE policy = $1`, [policy])).revoked, true)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
