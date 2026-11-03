// A protected policy changes only by the stricter procedure it names, end
// to end on a seeded Lanterne, through the handlers: its rights, and the
// collective mandates that hand out mandates, are protected by the
// extraordinary assembly's procedure; an ordinary assembly's motion ending
// the members' right to draw on their account is refused, saying which
// procedure it needs; the same motion put to the extraordinary assembly
// and passed ends it, and its mandate is revoked; and a policy naming a
// procedure looser than its own motion's is refused. Run by `cella test
// e2e protected`.

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
  (await one<{ policy: string }>(`SELECT policy FROM circle.mandate WHERE "right" = 'member' AND power = 'draw-account'`)).policy

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
    `SELECT r.id, r.protected, coalesce('right ' || m."right", m.circle || ' ' || m.power) AS held
     FROM policy.policy r JOIN circle.mandate m ON m.policy = r.id
     WHERE r.protected IS NOT NULL ORDER BY r.n`,
  )
  assert.equal(protectedBy.length, 22)
  assert.ok(protectedBy.every((p) => p.protected === 'extraordinary'))
  assert.deepEqual(
    protectedBy.filter((p) => !p.held.startsWith('right ')).map((p) => p.held),
    ['ag adopt-policy', 'ag end-policy', 'ag seat-member', 'coordination adopt-policy', 'coordination end-policy', 'coordination seat-member'],
  )
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM circle.mandate WHERE "right" IS NOT NULL`)).n, 16)
})

test('an ordinary assembly\'s motion ending the members\' right to draw is refused, saying which procedure it needs', async () => {
  const policy = await drawing()
  const out = await propose(
    {
      circle: 'ag',
      title: 'End the members\' draws',
      procedure: 'ordinary',
      deadline: '2026-11-21',
      body: '',
      actions: [{ kind: 'end', args: { policy } }],
    },
    as(camille),
  )
  assert.match(
    reason(out),
    new RegExp(`${policy} is protected: only a motion decided by extraordinary, or by a stricter procedure, replaces or ends it`),
  )
})

test('a policy naming a procedure looser than its own motion\'s is refused', async () => {
  const out = await propose(
    {
      circle: 'ag',
      title: 'Members read the internal rules',
      procedure: 'extraordinary',
      deadline: '2026-11-21',
      body: '',
      actions: [
        {
          kind: 'policy',
          args: { kind: 'mandate', wording: 'Every {right: member} holds {power: mark-read}, to mark a text read', protected: 'ordinary' },
        },
      ],
    },
    as(camille),
  )
  assert.match(reason(out), /ordinary is looser than extraordinary, by which m-2026-\d+ is decided/)
})

test('the same motion put to the extraordinary assembly and passed ends the right, and its mandate is revoked', async () => {
  const policy = await drawing()
  const { motion } = settled(
    await propose(
      {
        circle: 'ag',
        title: 'End the members\' draws',
        procedure: 'extraordinary',
        deadline: '2026-11-21',
        body: 'Draws on capital accounts stop; members are repaid as the statutes say.',
        actions: [{ kind: 'end', args: { policy } }],
      },
      as(camille),
    ),
  )
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
  assert.equal((await one<{ revoked: boolean }>(`SELECT revoked IS NOT NULL AS revoked FROM circle.mandate WHERE policy = $1`, [policy])).revoked, true)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
