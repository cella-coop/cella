// The mandates a person holds by their seats, on a database holding the
// app's core, its circles, and the person and membership feats:
// `circle_person.holds` gives every seat that counts and has begun its
// role's mandates and the participant's, once for each circle the person
// sits in, and `circle_person.may` grants a power exactly where it lists a
// mandate for it. Run by `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@holds'
const chloe = 'chloe@holds'
const paul = 'paul@holds'
const lea = 'lea@holds'
const day = '2026-10-24'
let root = ''

type Held = { power: string; grantee: string; circle: string }
const holds = async (person: string) =>
  (await db.query<Held>(
    `SELECT m.power, m.grantee, h.circle FROM circle_person.holds($1, $2) h JOIN circle.mandate m ON m.id = h.mandate
     ORDER BY h.circle, m.grantee, m.power`,
    [person, day],
  )).rows

before(async () => {
  await db.connect()
  // The slice's tests share one database: what this one makes, it undoes.
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  root = (await db.query<{ id: string }>('SELECT circle.assembly() AS id')).rows[0].id
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('holds-web', 'Web')`)
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('holds-member', $1, 'Member')`, [root])
  await db.query(
    `INSERT INTO circle.mandate (grantee, issuer, power, policy, "from", until, revoked) VALUES
       ('participant', $1, 'propose', 'holds/1', '2026-01-01', NULL, NULL),
       ('participant', $1, 'discuss', 'holds/2', '2026-01-01', NULL, NULL),
       ('holds-member', $1, 'spread-capital', 'holds/3', '2026-01-01', NULL, NULL),
       ('holds-member', $1, 'approve-time', 'holds/4', '2026-01-01', NULL, '2026-10-01'),
       ('holds-member', $1, 'commit', 'holds/5', '2026-11-01', NULL, NULL)`,
    [root],
  )
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Inès'), ($2, 'Chloé'), ($3, 'Paul'), ($4, 'Léa')`, [ines, chloe, paul, lea])
  await db.query(
    `INSERT INTO membership.member (address, status, since, suspended) VALUES
       ($1, 'invited', NULL, NULL), ($2, 'active', '2022-01-10', NULL),
       ($3, 'suspended', '2022-01-10', '2026-10-01'), ($4, 'active', '2024-01-10', NULL)`,
    [ines, chloe, paul, lea],
  )
  await db.query(
    `INSERT INTO circle.member (circle, person, since) VALUES
       ('holds-web', $1, NULL), ('holds-web', $2, NULL), ('holds-web', $3, NULL), ('holds-web', $4, '2026-11-01')`,
    [ines, chloe, paul, lea],
  )
  await db.query(`INSERT INTO circle.tenure (circle, holder, role) VALUES ($1, $2, 'holds-member'), ($1, $3, 'holds-member')`, [root, chloe, paul])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a seat with no role holds the participant\'s mandates in its circle, and none of the assembly\'s', async () => {
  assert.deepEqual(await holds(ines), [
    { power: 'discuss', grantee: 'participant', circle: 'holds-web' },
    { power: 'propose', grantee: 'participant', circle: 'holds-web' },
  ])
})

test('a member holds the participant\'s once for each circle they sit in, beside their role\'s in force', async () => {
  assert.deepEqual(await holds(chloe), [
    { power: 'spread-capital', grantee: 'holds-member', circle: root },
    { power: 'discuss', grantee: 'participant', circle: root },
    { power: 'propose', grantee: 'participant', circle: root },
    { power: 'discuss', grantee: 'participant', circle: 'holds-web' },
    { power: 'propose', grantee: 'participant', circle: 'holds-web' },
  ], 'neither the revoked mandate nor the one not yet in force')
})

test('a suspended member\'s seats hold nothing, and a seat not yet begun holds nothing yet', async () => {
  assert.deepEqual(await holds(paul), [])
  assert.deepEqual(await holds(lea), [])
})

test('may grants a power exactly where holds lists a mandate for it', async () => {
  const powers = ['propose', 'discuss', 'spread-capital', 'approve-time', 'commit']
  for (const person of [ines, chloe, paul, lea]) {
    const held = new Set((await holds(person)).map((h) => h.power))
    for (const power of powers) {
      const { rows } = await db.query<{ may: boolean }>('SELECT circle_person.may($1, $2, NULL, NULL, $3) AS may', [person, power, day])
      assert.equal(rows[0].may, held.has(power), `${person} ${power}`)
    }
  }
})
