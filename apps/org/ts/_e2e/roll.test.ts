// Who may vote or veto is the procedure's, end to end on a seeded
// Lanterne, through the handlers: by default a motion's roll is the people
// seated in its circle when it was proposed, so Inès, employed and no
// member, votes on Web's motion and is refused a stance on the assembly's;
// a seat above carries no vote below, so Camille, seated in the assembly,
// is on no roll of Web's; and once the assembly adopts a procedure giving
// a circle's lead a veto, a Web motion decided by it with the majority
// for fails when its lead votes against, while one decided by majority
// passes. Run
// by `cella test e2e roll`.

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
const [camille, yusuf, ines] = ['camille', 'yusuf', 'ines'].map(at)
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)
const web = ['amina', 'ines', 'lea', 'thomas', 'yusuf'].map(at)
const led =
  "By the {label: led circle}'s procedure, {procedure: led}, a motion is decided by a {method: majority} of the votes cast, with a quorum of {quorum: none}, and the circle's {veto: lead} may veto it"

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
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT circle_membership_motion.passes($1) AS p', [d])).p
const roll = (d: string) => all<{ member: string; veto: boolean }>('SELECT member, veto FROM circle_membership_motion.roll WHERE motion = $1 ORDER BY member', [d])

// A motion of a circle's text alone acts under no mandate, so the circle's
// procedure decides it: the host stages that procedure, as only a
// superuser may, since no write sets one yet, and puts back Lanterne's
// consent once the motion keeps it.
const put = async (circle: string, title: string, procedure: string, deadline: string, by: string) => {
  await su.query('SET cella.unbound = on')
  await su.query('UPDATE circle.circle SET procedure = $1 WHERE id = $2', [procedure, circle])
  const { motion } = settled(await propose({ circle, title, deadline, body: '', actions: [] }, as(by)))
  await su.query("UPDATE circle.circle SET procedure = 'consent' WHERE id = $1", [circle])
  return motion
}

before(async () => {
  await su.connect()
  await on('2026-11-07')
})

after(async () => {
  await app.end()
  await su.end()
})

test('Inès, seated in Web and no member, votes on its motion and is refused a stance on the assembly\'s', async () => {
  const mine = await put('web', 'Move the staging sites to the new host', 'majority', '2026-11-21', yusuf)
  assert.deepEqual(await roll(mine), web.map((member) => ({ member, veto: false })))
  settled(await vote({ motion: mine, member: ines, stance: 'for' }, as(ines)))

  const theirs = await put('ag', 'Close the office on 24 December', 'majority', '2026-11-21', camille)
  const refused = await vote({ motion: theirs, member: ines, stance: 'for' }, as(ines))
  assert.match(reason(refused), new RegExp(`ines@lanterne\\.example is not on the roll of ${theirs}`))
})

test('a seat above carries no vote below: Camille, seated in the assembly, is on no roll of Web\'s', async () => {
  const d = await put('web', 'Adopt the component library', 'majority', '2026-11-21', yusuf)
  assert.ok(!(await roll(d)).some((r) => r.member === camille))
  const refused = await vote({ motion: d, member: camille, stance: 'for' }, as(camille))
  assert.match(reason(refused), new RegExp(`camille@lanterne\\.example is not on the roll of ${d}`))
})

test('a procedure giving the lead a veto refuses a motion the lead vetoes though the majority is for it', async () => {
  // The assembly adopts the procedure by consent.
  const { motion } = settled(
    await propose(
      {
        circle: 'ag',
        title: 'The led circle',
        procedure: 'consent',
        deadline: '2026-11-21',
        body: 'A working circle may decide by a majority its lead can veto.',
        actions: [{ kind: 'policy', args: { kind: 'procedure', wording: led } }],
      },
      as(camille),
    ),
  )
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-11-21')
  settled(await close({ motion }, as(camille)))
  assert.deepEqual((await carried(motion, as(camille))).map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.deepEqual(await one(`SELECT method, voters, veto FROM motion.procedure WHERE id = 'led'`), { method: 'majority', voters: null, veto: ['lead'] })

  // Put to Web under it, the lead may veto; put by majority, no one may.
  const vetoed = await put('web', 'Drop the agency\'s own site', 'led', '2026-12-05', yusuf)
  const counted = await put('web', 'Drop the agency\'s blog', 'majority', '2026-12-05', yusuf)
  assert.deepEqual(await roll(vetoed), web.map((member) => ({ member, veto: member === yusuf })))
  assert.ok((await roll(counted)).every((r) => !r.veto))
  for (const d of [vetoed, counted]) {
    for (const member of web) {
      settled(await vote({ motion: d, member, stance: member === yusuf ? 'against' : 'for' }, as(member)))
    }
  }
  await on('2026-12-05')
  for (const d of [vetoed, counted]) {
    settled(await close({ motion: d }, as(yusuf)))
  }
  assert.equal(await passes(vetoed), false, 'four for and the lead against: the lead vetoes it')
  assert.equal(await passes(counted), true, 'four for and one against, by majority, passes')
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
