// A motion's author is a grantee, end to end on a seeded Lanterne:
// Camille, who holds the gérante role by a tenure, proposes to the
// assembly as the gérante; Julien proposes as the assembly, naming no
// one; and Julien proposing as the gérante, which he does not hold, or
// as coordination, another circle, is refused, the reason naming the
// role or the circle and never him. Run by `cella test e2e author`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { motion as read } from '@cella/org-motion/api'
import { propose } from '@cella/org-graft-membership-motion/api'
import type { Propose } from '@cella/org-motion/models'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const julien = at('julien')

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const proposal = (title: string, author?: string): Propose => ({
  circle: 'ag',
  title,
  deadline: '2026-11-07',
  body: '',
  actions: [],
  ...(author ? { author } : {}),
})
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', out.reason)
  return out.value as T
}
const authorOf = async (motion: string) =>
  (await su.query<{ author: string }>('SELECT author FROM motion.motion WHERE id = $1', [motion])).rows[0]?.author

before(async () => {
  await su.connect()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '2026-10-24'`)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await app.end()
  await su.end()
})

test('Camille proposes to the assembly as the gérante, a role she holds that day', async () => {
  const { motion, author } = settled(await propose(proposal('The gérante asks the assembly', 'manager'), as(camille)))
  assert.equal(author, 'manager')
  assert.equal(await authorOf(motion), 'manager')
  const page = await read(as(camille).db, motion)
  assert.equal(page?.author, 'manager')
  assert.equal(page?.authorName, 'Gérante')
  const logged = await su.query<{ author: string }>(`SELECT form ->> 'author' AS author FROM cella.log WHERE op = 'motion:motion:propose' ORDER BY n DESC LIMIT 1`)
  assert.equal(logged.rows[0]?.author, 'manager')
})

test('a proposal naming no author is the circle\'s', async () => {
  const { motion, author } = settled(await propose(proposal('The assembly asks itself'), as(julien)))
  assert.equal(author, 'ag')
  assert.equal(await authorOf(motion), 'ag')
  assert.equal((await read(as(julien).db, motion))?.authorName, 'Assemblée générale')
})

test('Julien may propose as neither the gérante, which he does not hold, nor coordination', async () => {
  const unheld = await propose(proposal('Not his to ask', 'manager'), as(julien))
  assert.equal(unheld.state, 'refused')
  assert.match(
    unheld.state === 'refused' ? unheld.reason : '',
    /the manager role is held by no tenure of the proposer's on 2026-10-24: propose as ag, or as a role held that day/,
  )
  const other = await propose(proposal('Not a circle\'s to ask here', 'coordination'), as(julien))
  assert.equal(other.state, 'refused')
  const reason = other.state === 'refused' ? other.reason : ''
  assert.match(reason, /a motion of ag is proposed as ag or as a role its proposer holds, not as coordination, another circle/)
  assert.doesNotMatch(reason, /julien/)
})
