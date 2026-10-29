// Whether a decision passes by its procedure, on a database holding the
// app's core, the circle, decision and member feats and the grafts beneath
// this one: two thirds of the votes cast, abstentions counting for neither;
// a quorum of those counted, an abstention taking part; who counts while
// a decision is open, and at its close; `fixed`, which refuses a proposal
// that did not fix its roll, and `counts`, a close that did not count it;
// and a secret ballot's tally, sealed to the app until its close. Run by
// `cella test slice circle-decision-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const at = (name: string) => `${name}@lanterne.example`
const ten = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia']
let receipt = 0

// A decision as the decision feat inserts it; `propose` also fixes its
// roll, as this graft's proposal does.
const insert = (id: string, procedure: string) =>
  db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline)
     SELECT $1, 'ag', $1, p.rule, p.id, '2026-10-20', '2026-11-03' FROM decision.procedure p WHERE p.id = $2`,
    [id, procedure],
  )
const fix = async (id: string) => (await db.query<{ n: number }>('SELECT circle_decision_membership.fix($1) AS n', [id])).rows[0].n
const propose = async (id: string, procedure: string) => {
  await insert(id, procedure)
  await fix(id)
}
const vote = (decision: string, name: string, stance: string) =>
  db.query(`INSERT INTO decision.vote (receipt, decision, member, stance, at) VALUES ($1, $2, $3, $4, '2026-10-21')`, [++receipt, decision, at(name), stance])
const passes = async (decision: string) =>
  (await db.query<{ p: boolean | null }>('SELECT circle_decision_membership.passes($1) AS p', [decision])).rows[0].p
const turnout = async (decision: string) =>
  (await db.query('SELECT counted, given, quorate FROM circle_decision_membership.turnout($1)', [decision])).rows[0]
const counts = async (decision: string) =>
  (await db.query<{ r: string | null }>('SELECT circle_decision_membership.counts($1) AS r', [{ decision }])).rows[0].r
const fixed = async (decision: string) =>
  (await db.query<{ r: string | null }>('SELECT circle_decision_membership.fixed($1) AS r', [{ decision }])).rows[0].r

before(async () => {
  await db.connect()
  for (const name of ten) {
    await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, $2) ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2021-03-01', 20)`, [at(name), name])
  }
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('ag', 'Assemblée générale')`)
  for (const name of ten) {
    await db.query(`INSERT INTO circle_membership.position (circle, member, since) VALUES ('ag', $1, '2021-03-01')`, [at(name)])
  }
  await db.query(
    `INSERT INTO decision.procedure (id, label, rule, share_num, share_den, quorum_num, quorum_den) VALUES
       ('extraordinary', 'Extraordinary assembly', 'majority', 2, 3, 1, 2),
       ('ordinary', 'Ordinary assembly', 'majority', NULL, NULL, 1, 4)`,
  )
})

after(async () => {
  await db.end()
})

test('two thirds of the votes cast: six for and three against carry it, a fourth against does not', async () => {
  await propose('d-2026-101', 'two-thirds')
  for (const name of ten.slice(0, 6)) {
    await vote('d-2026-101', name, 'for')
  }
  for (const name of ten.slice(6, 9)) {
    await vote('d-2026-101', name, 'against')
  }
  await vote('d-2026-101', 'sofia', 'abstain')
  assert.equal(await passes('d-2026-101'), true)
  await vote('d-2026-101', 'sofia', 'against')
  assert.equal(await passes('d-2026-101'), false)
  // The same stances carry a plain majority.
  await propose('d-2026-102', 'majority')
  for (const [i, name] of ten.entries()) {
    await vote('d-2026-102', name, i < 6 ? 'for' : 'against')
  }
  assert.equal(await passes('d-2026-102'), true)
})

test('a quorum of those counted: two of ten fall short of a half, five meet it, an abstention taking part', async () => {
  await propose('d-2026-103', 'extraordinary')
  await vote('d-2026-103', 'camille', 'for')
  await vote('d-2026-103', 'yusuf', 'for')
  assert.deepEqual(await turnout('d-2026-103'), { counted: 10, given: 2, quorate: false })
  assert.equal(await passes('d-2026-103'), false)
  await vote('d-2026-103', 'hugo', 'for')
  await vote('d-2026-103', 'malik', 'for')
  await vote('d-2026-103', 'julien', 'abstain')
  assert.deepEqual(await turnout('d-2026-103'), { counted: 10, given: 5, quorate: true })
  assert.equal(await passes('d-2026-103'), true)
})

test('a member suspended while it is open no longer counts, and the close fixes who did', async () => {
  await propose('d-2026-104', 'ordinary')
  await vote('d-2026-104', 'camille', 'for')
  await vote('d-2026-104', 'yusuf', 'against')
  await vote('d-2026-104', 'hugo', 'for')
  assert.deepEqual(await turnout('d-2026-104'), { counted: 10, given: 3, quorate: true })
  await db.query(`UPDATE membership.member SET status = 'suspended' WHERE address = $1`, [at('hugo')])
  assert.deepEqual(await turnout('d-2026-104'), { counted: 9, given: 2, quorate: false })
  assert.equal(await passes('d-2026-104'), false)
  await db.query(`UPDATE decision.decision SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['d-2026-104', ++receipt])
  await db.query('SELECT circle_decision_membership.count($1)', ['d-2026-104'])
  await db.query(`UPDATE membership.member SET status = 'active' WHERE address = $1`, [at('hugo')])
  assert.deepEqual(await turnout('d-2026-104'), { counted: 9, given: 2, quorate: false })
})

test('a close that did not count its roll is refused; counted, it is not', async () => {
  await propose('d-2026-105', 'majority')
  await db.query(`UPDATE decision.decision SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['d-2026-105', ++receipt])
  assert.equal(await counts('d-2026-105'), "d-2026-105's close did not count its roll: those counted are its active members on the day it closes")
  assert.equal((await db.query<{ n: number }>('SELECT circle_decision_membership.count($1) AS n', ['d-2026-105'])).rows[0].n, 10)
  assert.equal(await counts('d-2026-105'), null)
})

test('a proposal that did not fix its roll is refused; fixed, it is not', async () => {
  await insert('d-2026-107', 'majority')
  assert.equal(await fixed('d-2026-107'), "d-2026-107's proposal did not fix its roll: its roll is those seated in ag on the day it is proposed")
  assert.equal(await fix('d-2026-107'), 10)
  assert.equal(await fixed('d-2026-107'), null)
})

test('a secret ballot\'s tally is sealed to the app until its close, and a redacted stance counts as none given', async () => {
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, ballot, proposed, deadline)
     VALUES ('d-2026-106', 'ag', 'd-2026-106', 'majority', 'election', 'secret', '2026-10-20', '2026-11-03')`,
  )
  await fix('d-2026-106')
  await vote('d-2026-106', 'camille', 'for')
  await vote('d-2026-106', 'yusuf', 'for')
  await vote('d-2026-106', 'hugo', 'against')
  // What the app reads of it, for camille.
  const tally = async () => {
    await db.query('BEGIN')
    try {
      await db.query('SET LOCAL ROLE cella_app')
      await db.query(`SELECT set_config('cella.actor', $1, true)`, [at('camille')])
      return (await db.query('SELECT passes, counted, given, quorate FROM circle_decision_membership.tally($1)', ['d-2026-106'])).rows[0]
    } finally {
      await db.query('ROLLBACK')
    }
  }
  assert.deepEqual(await tally(), { passes: null, counted: null, given: null, quorate: null })
  assert.equal(await passes('d-2026-106'), true)
  await db.query(`UPDATE decision.decision SET closed = '2026-11-03', cutoff = $2 WHERE id = $1`, ['d-2026-106', ++receipt])
  await db.query('SELECT circle_decision_membership.count($1)', ['d-2026-106'])
  assert.deepEqual(await tally(), { passes: true, counted: 10, given: 3, quorate: true })
  await db.query(`UPDATE decision.vote SET stance = 'redacted' WHERE decision = $1 AND member = $2`, ['d-2026-106', at('yusuf')])
  assert.deepEqual(await turnout('d-2026-106'), { counted: 10, given: 2, quorate: true })
  assert.equal(await passes('d-2026-106'), false)
})
