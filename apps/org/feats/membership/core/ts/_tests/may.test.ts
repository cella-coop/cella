// What a mandate covers, on a database holding the app's core,
// its circles, and the person and membership feats: `circle_person.may`
// reads a mandate's scope against the owning circle of the record a write
// concerns (`circle.covers`), never where a circle sits, since circles
// never nest: one on `own` covers the circle its seat is in, one on a
// circle that circle, one with none the whole coop. A seat in the
// circle grants nothing without a mandate. Run by `cella test slice
// membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const thomas = 'thomas@lanterne.example'

const may = async (actor: string, power: string, about: string | null, day = '2026-10-24') =>
  (await db.query<{ m: boolean }>('SELECT circle_person.may($1, $2, NULL, $3, $4) AS m', [actor, power, about, day])).rows[0].m

before(async () => {
  await db.connect()
  // The slice's tests share one database: what this one makes, it undoes.
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  for (const id of ['coordination', 'brand', 'web', 'operations']) {
    await db.query('INSERT INTO circle.circle (id, name) VALUES ($1, $1)', [id])
  }
  for (const [address, name] of [[hugo, 'Hugo'], [camille, 'Camille'], [julien, 'Julien'], [thomas, 'Thomas']]) {
    await db.query('INSERT INTO person.person (address, name) VALUES ($1, $2)', [address, name])
    await db.query(`INSERT INTO membership.member (address, status, since) VALUES ($1, 'active', '2024-01-10')`, [address])
  }
  await db.query(
    `INSERT INTO circle.role (id, circle, name) VALUES ('lead', '*', 'Circle lead'), ('manager', 'ag', 'Manager'), ('finance', 'operations', 'Finance')`,
  )
  await db.query(
    `INSERT INTO circle.mandate (grantee, issuer, power, policy, "from", scope) VALUES
       ('lead', 'ag', 'approve-time', 'm-2026-001/1', '2026-01-01', 'own'),
       ('manager', 'ag', 'approve-time', 'm-2026-001/2', '2026-01-01', NULL),
       ('finance', 'ag', 'approve-time', 'm-2026-001/3', '2026-01-01', 'web')`,
  )
  await db.query(
    `INSERT INTO circle.tenure (circle, holder, role, until) VALUES
       ('brand', $1, 'lead', NULL), ('ag', $2, 'manager', NULL), ('web', $1, 'lead', '2026-01-01'), ('operations', $3, 'finance', NULL)`,
    [hugo, camille, julien],
  )
  await db.query(`INSERT INTO circle.member (circle, person) VALUES ('web', $1)`, [thomas])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a lead\'s mandate, on their own circle, covers its records and no other\'s', async () => {
  assert.equal(await may(hugo, 'approve-time', 'brand'), true)
  assert.equal(await may(hugo, 'approve-time', 'web'), false, 'his seat there ended')
  assert.equal(await may(hugo, 'approve-time', 'coordination'), false)
  assert.equal(await may(hugo, 'approve-time', 'ag'), false, 'the root\'s records are the whole coop\'s')
  assert.equal(await may(hugo, 'commit', 'brand'), false)
})

test('a mandate on a circle covers that circle alone, wherever its holder sits', async () => {
  assert.equal(await may(julien, 'approve-time', 'web'), true)
  assert.equal(await may(julien, 'approve-time', 'operations'), false)
})

test('the manager\'s, on the whole coop, covers every circle\'s records, the root\'s among them', async () => {
  for (const c of ['ag', 'coordination', 'brand', 'web']) {
    assert.equal(await may(camille, 'approve-time', c), true, c)
  }
})

test('a seat in a circle grants nothing over its records without a mandate', async () => {
  assert.equal(await may(thomas, 'approve-time', 'web'), false)
})

test('asked of no record, any mandate for the power answers, whatever its scope', async () => {
  assert.equal(await may(hugo, 'approve-time', null), true)
  assert.equal(await may(thomas, 'approve-time', null), false)
})
