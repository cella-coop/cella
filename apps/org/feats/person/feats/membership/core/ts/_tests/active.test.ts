// Whether a person held an active membership on a day, on a database
// holding the app's core, the person feat and this one: from the day
// they were admitted, until the day they were suspended or left; never
// for one only invited, nor for a person who is no member. Run by
// `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const active = async (person: string, day: string) =>
  (await db.query<{ a: boolean }>('SELECT membership.active($1, $2) AS a', [person, day])).rows[0].a

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO person.person (address, name) VALUES
       ('amina@x', 'Amina'), ('basile@x', 'Basile'), ('cleo@x', 'Cléo'), ('dan@x', 'Dan'), ('eve@x', 'Eve')`,
  )
  await db.query(
    `INSERT INTO membership.member (address, status, since, invited, suspended, exited) VALUES
       ('amina@x', 'active', '2024-01-10', '2024-01-01', NULL, NULL),
       ('basile@x', 'suspended', '2024-01-10', '2024-01-01', '2025-06-01', NULL),
       ('cleo@x', 'exited', '2024-01-10', '2024-01-01', NULL, '2025-12-31'),
       ('dan@x', 'invited', NULL, '2026-10-01', NULL, NULL)`,
  )
})

after(async () => {
  await db.end()
})

test('an active member is active from the day they were admitted', async () => {
  assert.equal(await active('amina@x', '2024-01-09'), false)
  assert.equal(await active('amina@x', '2024-01-10'), true)
  assert.equal(await active('amina@x', '2026-10-29'), true)
})

test('a suspended member was active until the day of their suspension', async () => {
  assert.equal(await active('basile@x', '2025-05-31'), true)
  assert.equal(await active('basile@x', '2025-06-01'), false)
})

test('a member who left was active until the day they left', async () => {
  assert.equal(await active('cleo@x', '2025-12-30'), true)
  assert.equal(await active('cleo@x', '2025-12-31'), false)
})

test('one only invited, and a person who is no member, is not active', async () => {
  assert.equal(await active('dan@x', '2026-10-29'), false)
  assert.equal(await active('eve@x', '2026-10-29'), false)
})
