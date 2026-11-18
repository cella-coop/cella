// The default bundle, end to end on a seeded Lanterne, through the
// handlers: the assembly creates Design by motion, under its collective
// `create-circle`, and seats Inès in it and Chloé as its lead in the same
// motion; with no further motion, Chloé runs Design's projects and Inès,
// no member, reads them, by the mandates on the roles every circle has;
// open books lets Hugo, in Brand, read Web's expenses, while Inès reads
// no Brand project; and once the assembly grants the secretary role
// `manage-project` on its own circle, the next circle it creates holds
// the changed bundle, and its creation's entry names it. Run by `cella
// test e2e bundle`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { create } from '@cella/org-project/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const chloe = at('chloe')
const hugo = at('hugo')
const ines = at('ines')
const thomas = at('thomas')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

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

// Raw queries on the app's role, reading as `actor`.
const reading = async <R>(actor: string, sql: string, values: unknown[] = []) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
  const rows = (await app.query(sql, values)).rows as R[]
  await app.query(`SELECT set_config('cella.actor', '', false)`)
  return rows
}

// A motion of the assembly carrying its actions, passed by consent and
// carried out on its deadline; returns what was carried.
async function decided(title: string, actions: { kind: string; args: Record<string, string> }[], from: string, deadline: string) {
  await on(from)
  const { motion } = settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline, body: '', actions }, as(camille)))
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return carried(motion, as(camille))
}

const states = (out: Done[]) => out.map((d) => [d.op, d.state, d.reason ?? ''])

// The bundle a creation's entry names, by mandate id.
const named = async (out: Done[]) => {
  const made = out.find((d) => d.op === 'circle:circle:create')
  assert.ok(made?.entry, 'the creation settled')
  return (await one<{ b: number[] }>(`SELECT cella.opened($1) -> 'bundle' AS b`, [made.entry])).b
}

// The mandate a policy of the founding motion grants, by its wording.
const granted = async (wording: string) =>
  Number(
    (
      await one<{ id: string }>(
        `SELECT m.id FROM circle.mandate m JOIN policy.wording w ON w.policy = m.policy WHERE policy.sentence(w.legal) = $1`,
        [wording],
      )
    ).id,
  )

let first: number[] = []

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the assembly creates Design by motion and seats Inès and its lead in it, the creation naming the bundle in force', async () => {
  const out = await decided(
    'Create the Design circle',
    [
      { kind: 'circle', args: { id: 'design', name: 'Design', purpose: 'product and service design' } },
      { kind: 'seat', args: { circle: 'design', member: ines } },
      { kind: 'seat', args: { circle: 'design', member: chloe, role: 'lead' } },
    ],
    '2026-10-24',
    '2026-11-07',
  )
  assert.deepEqual(states(out), [
    ['circle:circle:create', 'settled', ''],
    ['circle:seat:add', 'settled', ''],
    ['circle:seat:add', 'settled', ''],
  ])
  assert.deepEqual(await one(`SELECT name, purpose, assembly FROM circle.circle WHERE id = 'design'`), {
    name: 'Design',
    purpose: 'product and service design',
    assembly: false,
  })
  first = await named(out)
  const bundle = (await one<{ b: string[] }>(`SELECT circle.bundle('2026-11-07') AS b`)).b.map(Number)
  assert.deepEqual(first, bundle, 'the entry names the bundle in force on its verdict date')
  assert.ok(first.includes(await granted('The participant role holds read, to read the records of its own circle')), 'its members read its records')
  assert.ok(first.includes(await granted('The lead role holds manage-project, to start and run the projects of its own circle')), 'its lead runs its projects')
  assert.ok(!first.includes(await granted("The member role holds read, to read every circle's records")), 'open books is no part of it')
})

test('with no further motion, Design\'s lead runs its projects, and Inès, seated there, reads them', async () => {
  await on('2026-11-09')
  const made = settled(await create({ id: 'design-first', title: 'Design system', circle: 'design' }, as(chloe)))
  assert.equal(made.circle, 'design')
  const astray = await create({ id: 'design-astray', title: 'Not Hugo\'s to start', circle: 'design' }, as(hugo))
  assert.match(reason(astray), /holds manage-project by no mandate covering design's records/, 'Brand\'s lead covers Brand alone')

  assert.deepEqual(await reading(ines, `SELECT id FROM project.project WHERE circle = 'design'`), [{ id: 'design-first' }], 'Inès reads Design\'s project')
  assert.deepEqual(await reading(ines, `SELECT id FROM project.project WHERE circle = 'brand'`), [], 'and no Brand project: no member, she holds no open books')
})

test('open books: Hugo, in Brand, reads Web\'s expenses', async () => {
  const web = await reading<{ id: string }>(hugo, `SELECT id FROM expense.expense WHERE circle = 'web' ORDER BY id`)
  assert.ok(web.some((e) => e.id === 'ex-0002'), 'a member reads every circle\'s records')
  assert.deepEqual(await reading(ines, `SELECT id FROM expense.expense WHERE circle = 'marketing'`), [])
})

test('a co-op that changes the template issues the changed bundle to the next circle it creates', async () => {
  const wording = 'The {role: secretary} role holds {power: manage-project}, to start and run the projects of its {scope: own} circle'
  const adopted = await decided('Secretaries run their circle\'s projects', [{ kind: 'policy', args: { kind: 'mandate', wording } }], '2026-11-09', '2026-11-23')
  assert.deepEqual(states(adopted), [['motion:policy:adopt', 'settled', '']])
  const added = await granted('The secretary role holds manage-project, to start and run the projects of its own circle')
  assert.ok(!first.includes(added), 'Design was created before it')

  const out = await decided(
    'Create the Events circle',
    [
      { kind: 'circle', args: { id: 'events', name: 'Events', purpose: 'workshops and talks' } },
      { kind: 'seat', args: { circle: 'events', member: thomas, role: 'secretary' } },
    ],
    '2026-11-23',
    '2026-12-07',
  )
  assert.deepEqual(states(out), [
    ['circle:circle:create', 'settled', ''],
    ['circle:seat:add', 'settled', ''],
  ])
  const changed = await named(out)
  assert.deepEqual(changed, [...first, added].sort((a, b) => a - b), 'the changed bundle: the first, and the secretary\'s new mandate')
  settled(await create({ id: 'events-season', title: 'The autumn season', circle: 'events' }, as(thomas)))
})

test('a circle is created only with a fresh id in lower case and a name, and a seat names a circle there is or one the motion creates first', async () => {
  await on('2026-12-07')
  const proposing = (actions: { kind: string; args: Record<string, string> }[]) =>
    propose({ circle: 'ag', title: 'A circle', procedure: 'consent', deadline: '2026-12-21', body: '', actions }, as(camille))
  assert.match(reason(await proposing([{ kind: 'circle', args: { id: 'web', name: 'Web again' } }])), /a circle or a role web is there already/)
  assert.match(reason(await proposing([{ kind: 'circle', args: { id: 'lead', name: 'Leads' } }])), /a circle or a role lead is there already/)
  assert.match(reason(await proposing([{ kind: 'circle', args: { id: 'Sales', name: 'Sales' } }])), /a circle is created with an id in lower case/)
  assert.match(reason(await proposing([{ kind: 'circle', args: { id: 'sales', name: ' ' } }])), /a circle is created with a name/)
  assert.match(
    reason(
      await proposing([
        { kind: 'seat', args: { circle: 'sales', member: ines } },
        { kind: 'circle', args: { id: 'sales', name: 'Sales' } },
      ]),
    ),
    /no circle sales/,
    'a seat before the action that creates its circle',
  )
  const web = await propose(
    { circle: 'web', title: 'A circle of our own', procedure: 'consent', deadline: '2026-12-21', body: '', actions: [{ kind: 'circle', args: { id: 'sales', name: 'Sales' } }] },
    as(at('amina')),
  )
  assert.match(reason(web), /web holds no collective mandate for create-circle, so its motion may not create a circle/)
})
