// Open and secret ballots, alone, on a database holding only the app's
// core and this feat: election is built in by secret ballot; a motion
// keeps the ballot it was proposed by, as its payload names it; a stance
// on a secret ballot is logged by its commitment alone, one on an open
// ballot as given; and the app reads a secret ballot's stance only as its
// own member's, an open ballot's to whoever reads its circle. Run by `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const at = (name: string) => `${name}@lanterne.example`
const commitment = { $commit: '00'.repeat(32) }

const seals = async (payload: unknown) => (await db.query<{ r: string | null }>('SELECT motion.seals($1) AS r', [payload])).rows[0].r
const balloted = async (payload: unknown) => (await db.query<{ r: string | null }>('SELECT motion.balloted($1) AS r', [payload])).rows[0].r

// The motions' stances as the app reads them for a member.
async function reads(member: string): Promise<{ motion: string; member: string }[]> {
  await db.query('BEGIN')
  try {
    await db.query('SET LOCAL ROLE cella_app')
    await db.query(`SELECT set_config('cella.actor', $1, true)`, [member])
    return (await db.query(`SELECT motion, member FROM motion.vote WHERE motion IN ('m-2026-301', 'm-2026-302') ORDER BY receipt`)).rows
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
  // A stub authority: every member reads the assembly's records by `read`,
  // as Lanterne's participants do, in place of core's, which reads seats.
  await db.query(`CREATE SCHEMA mandate`)
  await db.query(`CREATE FUNCTION mandate.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean LANGUAGE sql STABLE RETURN false`)
  await db.query(
    `CREATE FUNCTION mandate.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN power = 'read' THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(`INSERT INTO cella.authority (fn, covered, owner) VALUES ('mandate.may(text, text, bigint, text, date)', 'mandate.covered(text, text, date)', 'test') ON CONFLICT (one) DO UPDATE SET fn = excluded.fn, covered = excluded.covered, owner = excluded.owner`)
  await db.query(
    `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, ballot, proposed, deadline) VALUES
       ('m-2026-301', 'ag', 'camille@lanterne.example', 'An action', 'majority', 'majority', 'open', '2026-10-20', '2026-11-03'),
       ('m-2026-302', 'ag', 'camille@lanterne.example', 'An election', 'majority', 'election', 'secret', '2026-10-20', '2026-11-03')`,
  )
  let receipt = 2000
  for (const motion of ['m-2026-301', 'm-2026-302']) {
    for (const [name, stance] of [['camille', 'for'], ['yusuf', 'against']]) {
      await db.query(`INSERT INTO motion.vote (receipt, motion, member, stance, at) VALUES ($1, $2, $3, $4, '2026-10-21')`, [
        ++receipt,
        motion,
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
  const { rows } = await db.query(`SELECT id, method, ballot FROM motion.procedure WHERE id IN ('consent', 'election', 'majority', 'two-thirds') ORDER BY id`)
  assert.deepEqual(rows, [
    { id: 'consent', method: 'consent', ballot: 'open' },
    { id: 'election', method: 'majority', ballot: 'secret' },
    { id: 'majority', method: 'majority', ballot: 'open' },
    { id: 'two-thirds', method: 'majority', ballot: 'open' },
  ])
})

test('motion.balloted refuses a proposal whose ballot is not its payload\'s', async () => {
  assert.equal(await balloted({ motion: 'm-2026-302', ballot: 'secret' }), null)
  assert.equal(await balloted({ motion: 'm-2026-302', ballot: 'open' }), 'm-2026-302 is taken by secret ballot, not open')
  assert.equal(await balloted({ motion: 'm-2026-301' }), 'm-2026-301 is taken by open ballot, not none named')
})

test('motion.seals refuses a secret stance logged as given, and an open one logged by its commitment', async () => {
  assert.equal(await seals({ motion: 'm-2026-302', member: at('camille'), stance: commitment }), null)
  assert.equal(
    await seals({ motion: 'm-2026-302', member: at('camille'), stance: 'for' }),
    'm-2026-302 is a secret ballot: its stance is logged by its commitment alone',
  )
  assert.equal(await seals({ motion: 'm-2026-301', member: at('camille'), stance: 'for' }), null)
  assert.equal(
    await seals({ motion: 'm-2026-301', member: at('camille'), stance: commitment }),
    'm-2026-301 is an open ballot: its stance is logged as given',
  )
})

test('the app reads every stance on an open ballot to whoever reads its circle, and on a secret one only the reader\'s own', async () => {
  assert.deepEqual(await reads(at('camille')), [
    { motion: 'm-2026-301', member: at('camille') },
    { motion: 'm-2026-301', member: at('yusuf') },
    { motion: 'm-2026-302', member: at('camille') },
  ])
  assert.deepEqual(await reads(at('yusuf')), [
    { motion: 'm-2026-301', member: at('camille') },
    { motion: 'm-2026-301', member: at('yusuf') },
    { motion: 'm-2026-302', member: at('yusuf') },
  ])
  assert.deepEqual(await reads(''), [], 'no one signed in reads any, as no one reads the motion\'s circle')
})

test('a stance is personal data of its member, kept as the books are, and the sweep\'s marker is a stance', async () => {
  const { rows } = await db.query(`SELECT class, subject FROM cella.personal WHERE schema = 'motion' AND tab = 'vote' AND col = 'stance'`)
  assert.deepEqual(rows, [{ class: 'books', subject: 'member' }])
  await db.query('BEGIN')
  try {
    await db.query(`UPDATE motion.vote SET stance = 'redacted' WHERE member = $1`, [at('yusuf')])
  } finally {
    await db.query('ROLLBACK')
  }
})
