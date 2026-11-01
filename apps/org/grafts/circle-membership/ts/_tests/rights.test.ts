// Rights, on a database holding the app's core, the circle and member
// feats and this graft: `circle_membership.entitled` finds a right's mandate
// with no seat, held by whoever person's core says is one of the people
// it names that day: every person, every active member. A right no feat
// registered, every employee's here, where employment is not migrated,
// is held by no one. Run by `cella test slice circle-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const amina = 'amina@x'
const ines = 'ines@x'
const paul = 'paul@x'

const holds = async (actor: string, power: string, day = '2026-10-24') =>
  (await db.query<{ m: boolean }>('SELECT circle_membership.may($1, $2, NULL, $3) OR circle_membership.entitled($1, $2, NULL, $3) AS m', [actor, power, day])).rows[0].m

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Amina'), ($2, 'Inès'), ($3, 'Paul')`, [amina, ines, paul])
  await db.query(
    `INSERT INTO membership.member (address, status, since, exited) VALUES
       ($1, 'active', '2024-01-10', NULL), ($2, 'invited', NULL, NULL), ($3, 'exited', '2021-03-01', '2025-11-30')`,
    [amina, ines, paul],
  )
  await db.query(
    `INSERT INTO circle.mandate ("right", power, policy, "from") VALUES
       ('person', 'keep-profile', 'm-2021-001/1', '2021-03-01'),
       ('member', 'draw-account', 'm-2021-001/2', '2021-03-01'),
       ('employee', 'log-own-time', 'm-2021-001/3', '2021-03-01')`,
  )
})

after(async () => {
  await db.end()
})

test('every person holds a person\'s right, member or not, with no seat; someone unknown holds none', async () => {
  for (const who of [amina, ines, paul]) {
    assert.equal(await holds(who, 'keep-profile'), true, who)
  }
  assert.equal(await holds('nobody@x', 'keep-profile'), false)
  const seats = await db.query('SELECT count(*)::int AS n FROM circle_membership.seat WHERE member = ANY($1)', [[amina, ines, paul]])
  assert.equal(seats.rows[0].n, 0)
})

test('a member\'s right is held by the active members on the day: not by an invitee, nor by one gone since', async () => {
  assert.equal(await holds(amina, 'draw-account'), true)
  assert.equal(await holds(ines, 'draw-account'), false)
  assert.equal(await holds(paul, 'draw-account'), false)
  assert.equal(await holds(paul, 'draw-account', '2025-06-01'), true, 'he was a member then')
})

test('a right nobody registered is held by no one, and a right grants only its power', async () => {
  assert.equal(await holds(amina, 'log-own-time'), false)
  assert.equal(await holds(amina, 'approve-time'), false)
})

test('a right is never the authority reads ask: it lets each act on their own, and opens no one else\'s rows', async () => {
  assert.equal((await db.query(`SELECT circle_membership.entitled($1, 'keep-profile', NULL, '2026-10-24') AS m`, [amina])).rows[0].m, true)
  assert.equal((await db.query(`SELECT circle_membership.may($1, 'keep-profile', NULL, '2026-10-24') AS m`, [amina])).rows[0].m, false)
})
