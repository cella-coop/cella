// A procedure is a policy, end to end on a seeded Lanterne, through the
// handlers: the six procedures it decides by are policies of the assembly,
// adopted by its founding motion; a procedure policy whose quorum is not
// marked is refused at its proposal; the assembly adopts by consent a
// procedure of two thirds of the votes cast once half take part, its
// values copied into the procedure a motion is counted by; and, the
// assembly deciding by it, a motion of its text alone with six for and
// four against fails, one with seven for and three against passes,
// whatever procedure its proposal names. Run by `cella test e2e procedure`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)
const statutory =
  "By the {label: statutory assembly}'s procedure, {procedure: statutory}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: 1/2} of those on its roll, by {ballot: open} ballot"

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
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT membership_motion.passes($1) AS p', [d])).p

before(async () => {
  await su.connect()
  await on('2026-11-07')
})

after(async () => {
  await app.end()
  await su.end()
})

test('Lanterne decides by six procedures, each a policy of the assembly its founding motion adopted', async () => {
  assert.deepEqual(
    await all(
      `SELECT o.id, o.policy, r.circle, to_char(r.adopted, 'YYYY-MM-DD') AS adopted
       FROM motion.procedure o JOIN policy.policy r ON r.id = o.policy ORDER BY r.n`,
    ),
    ['consent', 'majority', 'two-thirds', 'election', 'ordinary', 'extraordinary'].map((id, i) => ({
      id,
      policy: `m-2021-001/${i + 1}`,
      circle: 'ag',
      adopted: '2021-03-01',
    })),
  )
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM motion.procedure WHERE policy IS NULL')).n, '0')
  // The extraordinary assembly's terms are the values its sentence marks.
  assert.deepEqual(
    await one(`SELECT label, method, share_num, share_den, quorum_num, quorum_den, ballot FROM motion.procedure WHERE id = 'extraordinary'`),
    { label: 'Extraordinary assembly', method: 'majority', share_num: 2, share_den: 3, quorum_num: 1, quorum_den: 2, ballot: 'open' },
  )
})

test('a procedure policy whose quorum is not marked is refused at its proposal', async () => {
  const unmarked = await propose(
    {
      circle: 'ag',
      title: 'The statutory assembly',
      procedure: 'consent',
      deadline: '2026-11-21',
      body: '',
      actions: [{ kind: 'policy', args: { kind: 'procedure', wording: 'By {procedure: statutory}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast' } }],
    },
    as(camille),
  )
  assert.match(reason(unmarked), /a procedure policy marks its quorum, as \{quorum: 1\/4\}/)
})

test('the assembly adopts the statutory procedure by consent, and its values make the procedure motions are counted by', async () => {
  const { motion } = settled(
    await propose(
      {
        circle: 'ag',
        title: 'The statutory assembly',
        procedure: 'consent',
        deadline: '2026-11-21',
        body: 'Amendments to the statutes need two thirds of the votes cast, once half the assembly takes part.',
        actions: [{ kind: 'policy', args: { kind: 'procedure', wording: statutory } }],
      },
      as(camille),
    ),
  )
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-11-21')
  settled(await close({ motion }, as(camille)))
  const out = await carried(motion, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.deepEqual(
    await one(`SELECT label, method, share_num, share_den, quorum_num, quorum_den, ballot, policy FROM motion.procedure WHERE id = 'statutory'`),
    { label: 'Statutory assembly', method: 'majority', share_num: 2, share_den: 3, quorum_num: 1, quorum_den: 2, ballot: 'open', policy: `${motion}/1` },
  )
  assert.deepEqual(await one(`SELECT kind, circle FROM policy.policy WHERE id = $1`, [`${motion}/1`]), { kind: 'procedure', circle: 'ag' })
})

test('put under it, six for and four against fails, seven for and three against passes', async () => {
  // The host stages the assembly's procedure, as only a superuser may: no
  // write sets one yet. A motion of its text alone acts under no mandate,
  // so its circle's procedure decides it.
  await su.query("SET cella.unbound = on; UPDATE circle.circle SET procedure = 'statutory' WHERE id = 'ag'")
  const put = async (title: string, fors: number) => {
    const { motion } = settled(
      await propose({ circle: 'ag', title, procedure: 'consent', deadline: '2026-12-05', body: '', actions: [] }, as(camille)),
    )
    assert.deepEqual(await one('SELECT method, procedure FROM motion.motion WHERE id = $1', [motion]), { method: 'majority', procedure: 'statutory' })
    for (const [i, member] of assembly.entries()) {
      settled(await vote({ motion, member, stance: i < fors ? 'for' : 'against' }, as(member)))
    }
    return motion
  }
  const six = await put('Amend the statutes: the work share paid in December', 6)
  const seven = await put('Amend the statutes: the seat moves to Bagnolet', 7)
  await on('2026-12-05')
  for (const motion of [six, seven]) {
    settled(await close({ motion }, as(camille)))
  }
  assert.equal(await passes(six), false, 'six in ten is short of two thirds')
  assert.equal(await passes(seven), true, 'seven in ten is two thirds and more')
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
