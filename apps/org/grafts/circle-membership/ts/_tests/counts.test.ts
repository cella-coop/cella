// Whose seat counts, on a database holding the app's core, the circle and
// member feats and this graft: any person may hold a seat, and only the
// assembly's asks an active membership; a member suspended or gone holds
// none that counts, and someone the co-op does not know holds none at
// all. Run by `cella test slice circle-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const lea = 'lea@counts'
const ines = 'ines@counts'
const chloe = 'chloe@counts'
const paul = 'paul@counts'
let root = ''

const counts = async (person: string, circle: string, day = '2026-10-24') =>
  (await db.query<{ c: boolean }>('SELECT circle_membership.counts($1, $2, $3) AS c', [person, circle, day])).rows[0].c

before(async () => {
  await db.connect()
  // The slice's tests share one database: what this one makes, it undoes.
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  root = (await db.query<{ id: string }>('SELECT circle.assembly() AS id')).rows[0].id
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('counts-web', 'Web')`)
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Léa'), ($2, 'Inès'), ($3, 'Chloé'), ($4, 'Paul')`, [lea, ines, chloe, paul])
  await db.query(
    `INSERT INTO membership.member (address, status, since, suspended, exited) VALUES
       ($1, 'active', '2024-01-10', NULL, NULL), ($2, 'invited', NULL, NULL, NULL),
       ($3, 'suspended', '2022-01-10', '2026-10-01', NULL), ($4, 'exited', '2021-03-01', NULL, '2025-11-30')`,
    [lea, ines, chloe, paul],
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an active member\'s seat counts anywhere', async () => {
  assert.equal(await counts(lea, root), true)
  assert.equal(await counts(lea, 'counts-web'), true)
})

test('a person who is no member sits in a working circle, and not in the assembly', async () => {
  assert.equal(await counts(ines, 'counts-web'), true)
  assert.equal(await counts(ines, root), false)
})

test('a member suspended or gone holds no seat that counts from that day, and did before it', async () => {
  assert.equal(await counts(chloe, 'counts-web'), false)
  assert.equal(await counts(chloe, 'counts-web', '2026-09-30'), true)
  assert.equal(await counts(paul, 'counts-web'), false)
  assert.equal(await counts(paul, root, '2025-11-29'), true)
})

test('someone the co-op does not know holds no seat that counts', async () => {
  assert.equal(await counts('nobody@counts', 'counts-web'), false)
})
