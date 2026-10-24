// How far a mandate reaches, on a database holding the app's core, the
// circle and member feats and this graft: `circle_member.over` lets a
// power held through a seat reach the seat's circle and the circles
// within it, and nothing above or beside. Run by `cella test slice
// circle-member`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'

const over = async (actor: string, power: string, about: string, day = '2026-10-24') =>
  (await db.query<{ o: boolean }>('SELECT circle_member.over($1, $2, $3, $4) AS o', [actor, power, about, day])).rows[0].o

before(async () => {
  await db.connect()
  for (const [id, parent] of [
    ['ag', null],
    ['coordination', 'ag'],
    ['brand', 'coordination'],
    ['web', 'coordination'],
  ]) {
    await db.query('INSERT INTO circle.circle (id, name, parent) VALUES ($1, $1, $2)', [id, parent])
  }
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('lead', '*', 'Circle lead'), ('manager', 'ag', 'Gérante')`)
  await db.query(
    `INSERT INTO circle.mandate (role, power, text) VALUES ('lead', 'approve-time', 'approve timesheets'), ('manager', 'approve-time', 'approve timesheets')`,
  )
  await db.query(
    `INSERT INTO circle_member.position (circle, member, role, until) VALUES
       ('brand', $1, 'lead', NULL), ('ag', $2, 'manager', NULL), ('web', $1, 'lead', '2026-01-01')`,
    [hugo, camille],
  )
})

after(async () => {
  await db.end()
})

test('a lead\'s mandate reaches their own circle, and no other', async () => {
  assert.equal(await over(hugo, 'approve-time', 'brand'), true)
  assert.equal(await over(hugo, 'approve-time', 'web'), false, 'his seat there ended')
  assert.equal(await over(hugo, 'approve-time', 'coordination'), false)
  assert.equal(await over(hugo, 'commit', 'brand'), false)
})

test('the gérante\'s, held in the assembly, reaches every circle within it', async () => {
  for (const c of ['ag', 'coordination', 'brand', 'web']) {
    assert.equal(await over(camille, 'approve-time', c), true, c)
  }
})
