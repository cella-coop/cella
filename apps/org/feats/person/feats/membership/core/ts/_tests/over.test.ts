// What a mandate covers, on a database holding the app's core,
// its circles, and the person and membership feats: `membership.over` reads
// a mandate's scope against the circle a record belongs to, never where
// a circle sits, since circles never nest: one on `own` covers the circle
// its seat is in, one on a circle that circle, one with none the whole
// co-op. Run by `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'

const over = async (actor: string, power: string, about: string | null, day = '2026-10-24') =>
  (await db.query<{ o: boolean }>('SELECT membership.over($1, $2, $3, $4) AS o', [actor, power, about, day])).rows[0].o

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  for (const id of ['coordination', 'brand', 'web', 'operations']) {
    await db.query('INSERT INTO circle.circle (id, name) VALUES ($1, $1)', [id])
  }
  await db.query(
    `INSERT INTO circle.role (id, circle, name) VALUES ('lead', '*', 'Circle lead'), ('manager', 'ag', 'Gérante'), ('finance', 'operations', 'Finance')`,
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
})

after(async () => {
  await db.end()
})

test('a lead\'s mandate, on their own circle, covers it and no other', async () => {
  assert.equal(await over(hugo, 'approve-time', 'brand'), true)
  assert.equal(await over(hugo, 'approve-time', 'web'), false, 'his seat there ended')
  assert.equal(await over(hugo, 'approve-time', 'coordination'), false)
  assert.equal(await over(hugo, 'approve-time', null), false, 'what belongs to no circle is the whole co-op\'s')
  assert.equal(await over(hugo, 'commit', 'brand'), false)
})

test('a mandate on a circle covers that circle alone, wherever its holder sits', async () => {
  assert.equal(await over(julien, 'approve-time', 'web'), true)
  assert.equal(await over(julien, 'approve-time', 'operations'), false)
})

test('the gérante\'s, on the whole co-op, covers every circle and what belongs to none', async () => {
  for (const c of ['ag', 'coordination', 'brand', 'web', null]) {
    assert.equal(await over(camille, 'approve-time', c), true, String(c))
  }
})
