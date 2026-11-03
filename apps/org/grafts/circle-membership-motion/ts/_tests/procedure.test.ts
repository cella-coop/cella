// Whether a motion passes by its procedure, on a database holding the
// app's core, the circle, motion and member feats and the grafts beneath
// this one: two thirds of the votes cast, abstentions counting for neither;
// a quorum of those counted, an abstention taking part; who counts while
// a motion is open, and at its close; `fixed`, which refuses a proposal
// that did not fix its roll, and `counts`, a close that did not count it;
// and a secret ballot's tally, sealed to the app until its close. Run by
// `cella test slice circle-membership-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const at = (name: string) => `${name}@lanterne.example`
const ten = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia']
let receipt = 0

// A motion as the motion feat inserts it; `propose` also fixes its
// roll, as this graft's proposal does.
const insert = (id: string, procedure: string) =>
  db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline)
     SELECT $1, 'ag', $1, p.method, p.id, '2026-10-20', '2026-11-03' FROM motion.procedure p WHERE p.id = $2`,
    [id, procedure],
  )
const fix = async (id: string) => (await db.query<{ n: number }>('SELECT circle_membership_motion.fix($1) AS n', [id])).rows[0].n
const propose = async (id: string, procedure: string) => {
  await insert(id, procedure)
  await fix(id)
}
const vote = (motion: string, name: string, stance: string) =>
  db.query(`INSERT INTO motion.vote (receipt, motion, member, stance, at) VALUES ($1, $2, $3, $4, '2026-10-21')`, [++receipt, motion, at(name), stance])
const passes = async (motion: string) =>
  (await db.query<{ p: boolean | null }>('SELECT circle_membership_motion.passes($1) AS p', [motion])).rows[0].p
const turnout = async (motion: string) =>
  (await db.query('SELECT counted, given, quorate FROM circle_membership_motion.turnout($1)', [motion])).rows[0]
const counts = async (motion: string) =>
  (await db.query<{ r: string | null }>('SELECT circle_membership_motion.counts($1) AS r', [{ motion }])).rows[0].r
const fixed = async (motion: string) =>
  (await db.query<{ r: string | null }>('SELECT circle_membership_motion.fixed($1) AS r', [{ motion }])).rows[0].r

before(async () => {
  await db.connect()
  for (const name of ten) {
    await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, $2) ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2021-03-01', 20)`, [at(name), name])
  }
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assemblée générale', true)`)
  for (const name of ten) {
    await db.query(`INSERT INTO circle_membership.member (circle, person, since) VALUES ('ag', $1, '2021-03-01')`, [at(name)])
  }
  await db.query(
    `INSERT INTO motion.procedure (id, label, method, share_num, share_den, quorum_num, quorum_den) VALUES
       ('extraordinary', 'Extraordinary assembly', 'majority', 2, 3, 1, 2),
       ('ordinary', 'Ordinary assembly', 'majority', NULL, NULL, 1, 4)`,
  )
})

after(async () => {
  await db.end()
})

test('two thirds of the votes cast: six for and three against carry it, a fourth against does not', async () => {
  await propose('m-2026-101', 'two-thirds')
  for (const name of ten.slice(0, 6)) {
    await vote('m-2026-101', name, 'for')
  }
  for (const name of ten.slice(6, 9)) {
    await vote('m-2026-101', name, 'against')
  }
  await vote('m-2026-101', 'sofia', 'abstain')
  assert.equal(await passes('m-2026-101'), true)
  await vote('m-2026-101', 'sofia', 'against')
  assert.equal(await passes('m-2026-101'), false)
  // The same stances carry a plain majority.
  await propose('m-2026-102', 'majority')
  for (const [i, name] of ten.entries()) {
    await vote('m-2026-102', name, i < 6 ? 'for' : 'against')
  }
  assert.equal(await passes('m-2026-102'), true)
})

test('a quorum of those counted: two of ten fall short of a half, five meet it, an abstention taking part', async () => {
  await propose('m-2026-103', 'extraordinary')
  await vote('m-2026-103', 'camille', 'for')
  await vote('m-2026-103', 'yusuf', 'for')
  assert.deepEqual(await turnout('m-2026-103'), { counted: 10, given: 2, quorate: false })
  assert.equal(await passes('m-2026-103'), false)
  await vote('m-2026-103', 'hugo', 'for')
  await vote('m-2026-103', 'malik', 'for')
  await vote('m-2026-103', 'julien', 'abstain')
  assert.deepEqual(await turnout('m-2026-103'), { counted: 10, given: 5, quorate: true })
  assert.equal(await passes('m-2026-103'), true)
})

test('a member suspended while it is open no longer counts, and the close fixes who did', async () => {
  await propose('m-2026-104', 'ordinary')
  await vote('m-2026-104', 'camille', 'for')
  await vote('m-2026-104', 'yusuf', 'against')
  await vote('m-2026-104', 'hugo', 'for')
  assert.deepEqual(await turnout('m-2026-104'), { counted: 10, given: 3, quorate: true })
  await db.query(`UPDATE membership.member SET status = 'suspended' WHERE address = $1`, [at('hugo')])
  assert.deepEqual(await turnout('m-2026-104'), { counted: 9, given: 2, quorate: false })
  assert.equal(await passes('m-2026-104'), false)
  await db.query(`UPDATE motion.motion SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['m-2026-104', ++receipt])
  await db.query('SELECT circle_membership_motion.count($1)', ['m-2026-104'])
  await db.query(`UPDATE membership.member SET status = 'active' WHERE address = $1`, [at('hugo')])
  assert.deepEqual(await turnout('m-2026-104'), { counted: 9, given: 2, quorate: false })
})

test('a close that did not count its roll is refused; counted, it is not', async () => {
  await propose('m-2026-105', 'majority')
  await db.query(`UPDATE motion.motion SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['m-2026-105', ++receipt])
  assert.equal(await counts('m-2026-105'), "m-2026-105's close did not count its roll: those counted are those of its roll whose seat counts on the day it closes")
  assert.equal((await db.query<{ n: number }>('SELECT circle_membership_motion.count($1) AS n', ['m-2026-105'])).rows[0].n, 10)
  assert.equal(await counts('m-2026-105'), null)
})

test('a proposal that did not fix its roll is refused; fixed, it is not', async () => {
  await insert('m-2026-107', 'majority')
  assert.equal(await fixed('m-2026-107'), "m-2026-107's proposal did not fix its roll: its roll is those its procedure calls in ag on the day it is proposed")
  assert.equal(await fix('m-2026-107'), 10)
  assert.equal(await fixed('m-2026-107'), null)
})

test('a secret ballot\'s tally is sealed to the app until its close, and a redacted stance counts as none given', async () => {
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, ballot, proposed, deadline)
     VALUES ('m-2026-106', 'ag', 'm-2026-106', 'majority', 'election', 'secret', '2026-10-20', '2026-11-03')`,
  )
  await fix('m-2026-106')
  await vote('m-2026-106', 'camille', 'for')
  await vote('m-2026-106', 'yusuf', 'for')
  await vote('m-2026-106', 'hugo', 'against')
  // What the app reads of it, for camille.
  const tally = async () => {
    await db.query('BEGIN')
    try {
      await db.query('SET LOCAL ROLE cella_app')
      await db.query(`SELECT set_config('cella.actor', $1, true)`, [at('camille')])
      return (await db.query('SELECT passes, counted, given, quorate FROM circle_membership_motion.tally($1)', ['m-2026-106'])).rows[0]
    } finally {
      await db.query('ROLLBACK')
    }
  }
  assert.deepEqual(await tally(), { passes: null, counted: null, given: null, quorate: null })
  assert.equal(await passes('m-2026-106'), true)
  await db.query(`UPDATE motion.motion SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['m-2026-106', ++receipt])
  await db.query('SELECT circle_membership_motion.count($1)', ['m-2026-106'])
  assert.deepEqual(await tally(), { passes: true, counted: 10, given: 3, quorate: true })
  await db.query(`UPDATE motion.vote SET stance = 'redacted' WHERE motion = $1 AND member = $2`, ['m-2026-106', at('yusuf')])
  assert.deepEqual(await turnout('m-2026-106'), { counted: 10, given: 2, quorate: true })
  assert.equal(await passes('m-2026-106'), false)
})

test('the guard covers every action that cites a motion, registered before this graft migrated or after, and refuses one until its motion passed', async () => {
  const carried = `'circle_membership_motion.carried(jsonb)'::regprocedure`
  const uncovered = await db.query(`SELECT c.op FROM motion.cites c WHERE NOT EXISTS (SELECT FROM cella.guard g WHERE g.op = c.op AND g.fn = ${carried})`)
  assert.deepEqual(uncovered.rows, [])
  assert.ok((await db.query('SELECT op FROM motion.cites')).rows.length >= 2)
  assert.deepEqual((await db.query('SELECT fn::text AS fn, owner FROM motion.cite_guard ORDER BY owner')).rows, [
    { fn: 'circle_membership_motion.carried(jsonb)', owner: 'circle-membership-motion' },
    { fn: 'circle_motion.mandated(jsonb)', owner: 'circle-motion' },
  ])

  await db.query(`SELECT motion.register_cite('later:thing:do', 'do-thing', 'later')`)
  assert.deepEqual((await db.query(`SELECT owner FROM cella.guard WHERE op = 'later:thing:do' AND fn = ${carried}`)).rows, [
    { owner: 'circle-membership-motion' },
  ])
  const judge = async (motion: string) =>
    (await db.query<{ r: string | null }>('SELECT circle_membership_motion.carried($1) AS r', [{ motion }])).rows[0].r
  await propose('m-2026-108', 'majority')
  assert.equal(await judge('m-2026-108'), 'm-2026-108 is not closed')
  for (const name of ten) {
    await vote('m-2026-108', name, 'for')
  }
  await db.query(`UPDATE motion.motion SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['m-2026-108', ++receipt])
  await db.query('SELECT circle_membership_motion.count($1)', ['m-2026-108'])
  assert.equal(await judge('m-2026-108'), null)
})
