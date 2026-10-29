// Open and secret ballots, alone, on a database holding only the app's
// core and this feat: election is built in by secret ballot; a decision
// keeps the ballot it was proposed by, as its payload names it; a stance
// on a secret ballot is logged by its commitment alone, one on an open
// ballot as given; and the app reads a secret ballot's stance only as its
// own member's, an open ballot's all. Run by `cella test slice decision`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const at = (name: string) => `${name}@lanterne.example`
const commitment = { $commit: '00'.repeat(32) }

const seals = async (payload: unknown) => (await db.query<{ r: string | null }>('SELECT decision.seals($1) AS r', [payload])).rows[0].r
const balloted = async (payload: unknown) => (await db.query<{ r: string | null }>('SELECT decision.balloted($1) AS r', [payload])).rows[0].r

// The decisions' stances as the app reads them for a member.
async function reads(member: string): Promise<{ decision: string; member: string }[]> {
  await db.query('BEGIN')
  try {
    await db.query('SET LOCAL ROLE cella_app')
    await db.query(`SELECT set_config('cella.actor', $1, true)`, [member])
    return (await db.query(`SELECT decision, member FROM decision.vote WHERE decision IN ('d-2026-301', 'd-2026-302') ORDER BY receipt`)).rows
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, ballot, proposed, deadline) VALUES
       ('d-2026-301', 'ag', 'A motion', 'majority', 'majority', 'open', '2026-10-20', '2026-11-03'),
       ('d-2026-302', 'ag', 'An election', 'majority', 'election', 'secret', '2026-10-20', '2026-11-03')`,
  )
  let receipt = 2000
  for (const decision of ['d-2026-301', 'd-2026-302']) {
    for (const [name, stance] of [['camille', 'for'], ['yusuf', 'against']]) {
      await db.query(`INSERT INTO decision.vote (receipt, decision, member, stance, at) VALUES ($1, $2, $3, $4, '2026-10-21')`, [
        ++receipt,
        decision,
        at(name),
        stance,
      ])
    }
  }
})

after(async () => {
  await db.end()
})

test('election is built in, a majority by secret ballot; the others are open', async () => {
  const { rows } = await db.query(`SELECT id, rule, ballot FROM decision.procedure WHERE id IN ('consent', 'election', 'majority', 'two-thirds') ORDER BY id`)
  assert.deepEqual(rows, [
    { id: 'consent', rule: 'consent', ballot: 'open' },
    { id: 'election', rule: 'majority', ballot: 'secret' },
    { id: 'majority', rule: 'majority', ballot: 'open' },
    { id: 'two-thirds', rule: 'majority', ballot: 'open' },
  ])
})

test('decision.balloted refuses a proposal whose ballot is not its payload\'s', async () => {
  assert.equal(await balloted({ decision: 'd-2026-302', ballot: 'secret' }), null)
  assert.equal(await balloted({ decision: 'd-2026-302', ballot: 'open' }), 'd-2026-302 is taken by secret ballot, not open')
  assert.equal(await balloted({ decision: 'd-2026-301' }), 'd-2026-301 is taken by open ballot, not none named')
})

test('decision.seals refuses a secret stance logged as given, and an open one logged by its commitment', async () => {
  assert.equal(await seals({ decision: 'd-2026-302', member: at('camille'), stance: commitment }), null)
  assert.equal(
    await seals({ decision: 'd-2026-302', member: at('camille'), stance: 'for' }),
    'd-2026-302 is a secret ballot: its stance is logged by its commitment alone',
  )
  assert.equal(await seals({ decision: 'd-2026-301', member: at('camille'), stance: 'for' }), null)
  assert.equal(
    await seals({ decision: 'd-2026-301', member: at('camille'), stance: commitment }),
    'd-2026-301 is an open ballot: its stance is logged as given',
  )
})

test('the app reads every stance on an open ballot, and on a secret one only the reader\'s own', async () => {
  assert.deepEqual(await reads(at('camille')), [
    { decision: 'd-2026-301', member: at('camille') },
    { decision: 'd-2026-301', member: at('yusuf') },
    { decision: 'd-2026-302', member: at('camille') },
  ])
  assert.deepEqual(await reads(at('yusuf')), [
    { decision: 'd-2026-301', member: at('camille') },
    { decision: 'd-2026-301', member: at('yusuf') },
    { decision: 'd-2026-302', member: at('yusuf') },
  ])
  assert.deepEqual(await reads(''), [
    { decision: 'd-2026-301', member: at('camille') },
    { decision: 'd-2026-301', member: at('yusuf') },
  ])
})

test('a stance is personal data of its member, kept as the books are, and the sweep\'s marker is a stance', async () => {
  const { rows } = await db.query(`SELECT class, subject FROM cella.personal WHERE schema = 'decision' AND tab = 'vote' AND col = 'stance'`)
  assert.deepEqual(rows, [{ class: 'books', subject: 'member' }])
  await db.query('BEGIN')
  try {
    await db.query(`UPDATE decision.vote SET stance = 'redacted' WHERE member = $1`, [at('yusuf')])
  } finally {
    await db.query('ROLLBACK')
  }
})
