// A policy adopted by motion, end to end on a seeded Lanterne, through the
// handlers: the assembly proposes that associations and small co-ops pay
// the solidarity rate, 20 % below the rate card; a proposal whose wording
// marks a value twice is refused; once the motion passes and its close
// carries it, the register keeps the policy with its motion, the day it
// applies and its value once, the assembly's page lists it in force, and
// its log entry commits to the wording's hash. Run by `cella test` on a
// fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { adopt, circles, vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const malik = 'malik@lanterne.example'
const legal = 'Associations and small co-ops pay the solidarity rate, {rate: 20 % | less is stricter} below the rate card'
const friendly = 'Associations and small co-ops pay a fifth less than the rate card.'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}

before(async () => {
  await su.connect()
  await on('2026-11-07')
})

after(async () => {
  await app.end()
  await su.end()
})

let motion = ''

test('a policy whose wording marks a value twice is refused at its proposal', async () => {
  const twice = await propose(
    {
      circle: 'ag',
      title: 'The solidarity rate',
      procedure: 'consent',
      deadline: '2026-11-21',
      body: '',
      actions: [{ kind: 'policy', args: { kind: 'rule', wording: 'Associations pay {rate: 20 %} below the rate card, never more than {rate: 20 %}' } }],
    },
    as(camille),
  )
  assert.match(reason(twice), /rate is marked twice: each value is marked once in its sentence/)
})

test('the assembly proposes the solidarity rate as a rule, and every member consents', async () => {
  const proposed = settled(
    await propose(
      {
        circle: 'ag',
        title: 'The solidarity rate',
        procedure: 'consent',
        deadline: '2026-11-21',
        body: 'Associations and small co-ops have asked for it since spring.',
        actions: [{ kind: 'policy', args: { kind: 'rule', wording: legal, friendly } }],
      },
      as(camille),
    ),
  )
  motion = proposed.motion
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
})

test('an adoption before the motion has passed is refused', async () => {
  const early = await adopt({ motion, n: 1 }, as(malik))
  assert.match(reason(early), new RegExp(`${motion} is not closed`))
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM policy.policy WHERE motion = $1', [motion])).n, '0')
})

test('the close carries it: the register keeps the policy with its motion, the day it applies and its value once', async () => {
  await on('2026-11-21')
  settled(await close({ motion }, as(camille)))
  const out = await carried(motion, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])

  const id = `${motion}/1`
  assert.deepEqual(
    await one(`SELECT id, circle, kind, motion, to_char(applies, 'YYYY-MM-DD') AS applies, ends, replaces FROM policy.policy WHERE id = $1`, [id]),
    { id, circle: 'ag', kind: 'rule', motion, applies: '2026-11-21', ends: null, replaces: null },
  )
  assert.deepEqual(await all('SELECT name, type, literal, value FROM policy.value WHERE policy = $1', [id]), [
    { name: 'rate', type: 'share', literal: '20 %', value: 20 },
  ])
  assert.deepEqual(await one('SELECT legal, friendly FROM policy.wording WHERE policy = $1', [id]), { legal, friendly })

  // The adoption's entry commits to what was adopted by its hash.
  const logged = await one<{ policy: string; hash: string }>(
    `SELECT form ->> 'policy' AS policy, form ->> 'hash' AS hash FROM cella.log WHERE op = 'motion:policy:adopt'`,
  )
  const hashed = await one<{ hash: string }>(`SELECT encode(policy.hash($1, $2), 'hex') AS hash`, [legal, friendly])
  assert.deepEqual(logged, { policy: id, hash: hashed.hash })
})

test('carried again, the adoption is refused: a policy is adopted once', async () => {
  const again = await adopt({ motion, n: 1 }, as(camille))
  assert.match(reason(again), /is adopted already/)
})

test('the assembly\'s page lists the policy in force, as it reads, with its motion and its days', async () => {
  const page = await circles.proposing(app, 'ag')
  assert.deepEqual(
    page?.policies.filter((p) => p.kind === 'rule' && p.motion === motion).map((p) => ({ id: p.id, sentence: p.sentence, motion: p.motion, applies: p.applies, ends: p.ends, values: p.values })),
    [
      {
        id: `${motion}/1`,
        sentence: 'Associations and small co-ops pay the solidarity rate, 20 % below the rate card',
        motion,
        applies: '2026-11-21',
        ends: null,
        values: [{ name: 'rate', type: 'share', literal: '20 %', value: 20, stricter: 'less' }],
      },
    ],
  )
  assert.deepEqual((await circles.proposing(app, 'coordination'))?.policies, [], 'a policy is its circle\'s')
})

test('a motion closed so late its policies would end on or before the day they apply passes, and adopts neither', async () => {
  const proposed = settled(
    await propose(
      {
        circle: 'ag',
        title: 'Remote work',
        procedure: 'consent',
        deadline: '2026-11-28',
        body: '',
        actions: [
          { kind: 'policy', args: { kind: 'rule', wording: 'Remote work is two days a week', until: '2026-12-01' } },
          { kind: 'policy', args: { kind: 'rule', wording: 'Remote work is three days a week', until: '2026-11-30' } },
        ],
      },
      as(camille),
    ),
  )
  const late = proposed.motion
  for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [late])) {
    settled(await vote({ motion: late, member, stance: 'consent' }, as(member)))
  }
  await on('2026-12-01')
  settled(await close({ motion: late }, as(camille)))
  const out = await carried(late, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state]), [
    ['motion:policy:adopt', 'refused'],
    ['motion:policy:adopt', 'refused'],
  ])
  assert.match(out[0].reason ?? '', new RegExp(`${late}/1 would end on 2026-12-01, not after 2026-12-01, the day it applies`))
  assert.match(out[1].reason ?? '', new RegExp(`${late}/2 would end on 2026-11-30, not after 2026-12-01, the day it applies`))
  assert.notEqual((await one<{ closed: string | null }>('SELECT closed FROM motion.motion WHERE id = $1', [late])).closed, null, 'the close stands')
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM policy.policy WHERE motion = $1', [late])).n, '0')
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
