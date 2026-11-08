// A motion seats a role in another circle, end to end on a seeded
// Lanterne: coordination seats the finance role, Operations', in Brand,
// so Julien, who holds it, reads Brand's records and votes on its
// motions; when finance passes from Julien to Thomas, Thomas sits in
// Brand with no seat of his own and Julien no longer does; and ending the
// role's seat in Brand leaves Thomas's tenure of finance standing. A role
// seated in its own circle, one seated twice, one there is not and a
// seat ended that no role holds are refused at the proposal, each saying
// what would fix it. Run by `cella test e2e role-seat`.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, story } = createStory()
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
const julien = at('julien')
const thomas = at('thomas')
const coordination = ['camille', 'hugo', 'julien', 'malik', 'yusuf'].map(at)

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
const seated = async (circle: string, day: string) =>
  (await all<{ s: string }>('SELECT s FROM circle.seated($1, $2) s ORDER BY s', [circle, day])).map((r) => r.s)
// Whether a seat in Brand brings the actor its participant's `read` of
// Brand's own records: every Lanterne member reads every circle's by
// open books, so it is the seat's read that shows.
const readsBrand = async (actor: string, day: string) =>
  (
    await one<{ r: boolean }>(
      `SELECT EXISTS (
         SELECT FROM membership.holds($1, $2) h JOIN circle.mandate m ON m.id = h.mandate
         WHERE h.circle = 'brand' AND m.power = 'read' AND m.scope = 'own'
       ) AS r`,
      [actor, day],
    )
  ).r

type Action = { kind: string; args: Record<string, string> }

// Coordination decides, every one of its seats consenting, and the
// motion is closed and carried on its deadline: what it carried, by op.
async function decided(title: string, actions: Action[], deadline: string) {
  const { motion } = settled(await propose({ circle: 'coordination', title, procedure: 'consent', deadline, body: '', actions }, as(camille)))
  for (const member of coordination) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return (await carried(motion, as(camille))).map((d) => [d.op, d.state])
}

// A motion of Brand's that `by` puts, and whether `voter` is on its roll
// and gives a stance.
async function votesInBrand(by: string, voter: string, deadline: string) {
  const { motion } = settled(await propose({ circle: 'brand', title: 'A new mark', deadline, body: '', actions: [] }, as(by)))
  const roll = await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1 ORDER BY member', [motion])
  assert.ok(roll.some((r) => r.member === voter), `${voter} is on the roll of Brand's motion`)
  settled(await vote({ motion, member: voter, stance: 'consent' }, as(voter)))
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('a role seated in its own circle, one seated twice, one there is not and an unseat of no seat are refused at the proposal', async () => {
  const refused = async (actions: Action[]) => {
    const out = await propose({ circle: 'coordination', title: 'Seats', procedure: 'consent', deadline: '2026-10-31', body: '', actions }, as(camille))
    assert.equal(out.state, 'refused')
    return reason(out)
  }
  assert.match(
    await refused([{ kind: 'seat-role', args: { circle: 'operations', role: 'finance' } }]),
    /the finance role is operations's own, where its holders sit by their tenures: seat it in another circle/,
  )
  assert.match(
    await refused([{ kind: 'seat-role', args: { circle: 'coordination', role: 'lead' } }]),
    /the lead role sits in coordination already: a role sits in a circle once, so end that seat first/,
  )
  assert.match(await refused([{ kind: 'seat-role', args: { circle: 'brand', role: 'auditor' } }]), /no role auditor: a role is seated by the id of one there is/)
  assert.match(await refused([{ kind: 'seat-role', args: { circle: 'nowhere', role: 'finance' } }]), /no circle nowhere/)
  assert.match(await refused([{ kind: 'unseat-role', args: { circle: 'web', role: 'finance' } }]), /the finance role holds no seat in web to end/)
})

test('a motion seats the finance role in Brand, whoever holds it sits there, and its end leaves the tenure standing', async () => {
  assert.equal((await seated('brand', '2026-10-24')).includes(julien), false)
  assert.equal(await readsBrand(julien, '2026-10-24'), false)

  assert.deepEqual(
    await decided('Finance sits in Brand', [{ kind: 'seat-role', args: { circle: 'brand', role: 'finance' } }], '2026-10-31'),
    [['circle:role:seat', 'settled']],
  )
  assert.deepEqual(
    await all(`SELECT circle, role, person, to_char(since, 'YYYY-MM-DD') AS since, until FROM circle.member WHERE role = 'finance'`),
    [{ circle: 'brand', role: 'finance', person: null, since: '2026-10-31', until: null }],
  )
  assert.equal((await seated('brand', '2026-10-31')).includes(julien), true, 'Julien, finance, sits in Brand')
  assert.equal((await seated('brand', '2026-10-30')).includes(julien), false, 'and did not before the seat')
  assert.equal(await readsBrand(julien, '2026-10-31'), true, 'he reads Brand\'s records by his seat there')
  await votesInBrand(julien, julien, '2026-11-07')

  // A second seat while the first runs is refused at the proposal.
  const twice = await propose(
    { circle: 'coordination', title: 'Finance sits in Brand again', procedure: 'consent', deadline: '2026-11-07', body: '', actions: [{ kind: 'seat-role', args: { circle: 'brand', role: 'finance' } }] },
    as(camille),
  )
  assert.match(reason(twice), /the finance role sits in brand already, since 2026-10-31: a role sits in a circle once, so end that seat first/)

  // Finance passes from Julien to Thomas: Thomas sits in Brand with no
  // seat of his own, and Julien no longer does.
  assert.deepEqual(
    await decided(
      'Thomas takes finance after Julien',
      [
        { kind: 'unseat', args: { circle: 'operations', member: julien, role: 'finance' } },
        { kind: 'seat', args: { circle: 'operations', member: thomas, role: 'finance' } },
      ],
      '2026-11-07',
    ),
    [
      ['circle:seat:remove', 'settled'],
      ['circle:seat:add', 'settled'],
    ],
  )
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM circle.member WHERE role = 'finance'`)).n, 1, 'no new seat in Brand')
  assert.equal((await seated('brand', '2026-11-07')).includes(thomas), true, 'Thomas sits in Brand')
  assert.equal((await seated('brand', '2026-11-07')).includes(julien), false, 'Julien no longer does')
  assert.equal(await readsBrand(thomas, '2026-11-07'), true)
  assert.equal(await readsBrand(julien, '2026-11-07'), false)
  await votesInBrand(at('sofia'), thomas, '2026-11-14')

  // Ending the role's seat in Brand ends no tenure.
  assert.deepEqual(
    await decided('Finance leaves Brand', [{ kind: 'unseat-role', args: { circle: 'brand', role: 'finance' } }], '2026-11-14'),
    [['circle:role:unseat', 'settled']],
  )
  assert.equal((await seated('brand', '2026-11-14')).includes(thomas), false, 'Thomas no longer sits in Brand')
  assert.equal((await seated('brand', '2026-11-13')).includes(thomas), true, 'he did the day before')
  assert.deepEqual(
    await all(`SELECT holder, to_char(since, 'YYYY-MM-DD') AS since, until FROM circle.tenure WHERE role = 'finance' AND until IS NULL`),
    [{ holder: thomas, since: '2026-11-07', until: null }],
    'his tenure of finance stands',
  )
  assert.equal((await seated('operations', '2026-11-14')).includes(thomas), true)
})

if (!process.env.CELLA_STORY) runTest('role-seat story', async (t) => story((name, step) => t.test(name, step)))
