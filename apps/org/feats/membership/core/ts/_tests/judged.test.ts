// A write judged before it is made, on a database holding the app's core,
// its circles, and the person and membership feats: `circle_person.judged`
// answers the reader what circle-person's guard would answer at a
// verdict, by the guard's own function (`circle_person.refused`), with no
// amount; nothing for a write the reader may make, for an op the guard
// does not attach to, or for no reader; and `judge`, the membership
// feat's, asks it of several ops in one read, the refused alone. Run by
// `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Permission } from '@cella/org-actions'
import { judge } from '../src/drivers/seat.ts'

const db = new pg.Client()
const hugo = 'hugo@judged'
const chloe = 'chloe@judged'
const approve = 'judged:claim:approve' as Permission
const reimburse = 'judged:claim:reimburse' as Permission
const note = 'judged:claim:note' as Permission

// As the reader, as the shell reads for the signed-in member.
const as = async (actor: string | null) => db.query(`SELECT set_config('cella.actor', $1, true)`, [actor ?? ''])
const judged = async (op: string, about: string | null) =>
  (await db.query<{ j: string | null }>('SELECT circle_person.judged($1, $2) AS j', [op, about])).rows[0].j
const refused = async (actor: string, power: string, about: string) =>
  (await db.query<{ r: string | null }>('SELECT circle_person.refused($1, $2, NULL, $3, cella.verdict_date()) AS r', [actor, power, about])).rows[0].r

before(async () => {
  await db.connect()
  // The slice's tests share one database: what this one makes, it undoes.
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  for (const c of ['brand', 'operations']) {
    await db.query('INSERT INTO circle.circle (id, name) VALUES ($1, $1) ON CONFLICT DO NOTHING', [c])
  }
  for (const [address, name] of [[hugo, 'Hugo'], [chloe, 'Chloé']]) {
    await db.query('INSERT INTO person.person (address, name) VALUES ($1, $2)', [address, name])
    await db.query(`INSERT INTO membership.member (address, status, since) VALUES ($1, 'active', '2024-01-10')`, [address])
  }
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('judge-lead', 'brand', 'Lead'), ('judge-hand', 'operations', 'Hand')`)
  await db.query(
    `INSERT INTO circle.mandate (grantee, issuer, power, policy, "limit", "from", scope) VALUES
       ('judge-lead', 'ag', 'judge-approve', 'judged/1', '1000.00', '2026-01-01', 'own'),
       ('judge-hand', 'ag', 'judge-reimburse', 'judged/2', NULL, '2026-01-01', NULL)`,
  )
  await db.query(`INSERT INTO circle.tenure (circle, holder, role) VALUES ('brand', $1, 'judge-lead'), ('operations', $2, 'judge-hand')`, [hugo, chloe])
  // Two ops with a power, which circle-person's guard attaches to as each
  // is registered, and one with no power, which it does not.
  await db.query(
    `INSERT INTO cella.power (op, power, amount, owner) VALUES ($1, 'judge-approve', 'amount', 'judged'), ($2, 'judge-reimburse', NULL, 'judged')`,
    [approve, reimburse],
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a write the reader may not make is judged as the guard would refuse it, with no amount', async () => {
  await as(chloe)
  const why = await judged(approve, 'brand')
  assert.ok(why)
  assert.equal(why, await refused(chloe, 'judge-approve', 'brand'))
  assert.match(why, /^the actor holds no mandate for judge-approve over brand's records: it is held by judge-lead in brand \(mandate \d+, issued by ag\)/)
})

test('a write the reader may make, whatever its amount would be, has no reason', async () => {
  await as(hugo)
  assert.equal(await judged(approve, 'brand'), null, 'no amount is judged before it is given')
  await as(chloe)
  assert.equal(await judged(reimburse, 'brand'), null)
})

test('a mandate over another circle\'s records refuses, and a record naming no circle asks of none', async () => {
  await as(hugo)
  assert.match((await judged(approve, 'operations')) ?? '', /^the actor holds judge-approve by no mandate covering operations's records/)
  assert.equal(await judged(approve, null), null)
})

test('an op the guard does not attach to, and no reader, are judged as nothing', async () => {
  await as(chloe)
  assert.equal(await judged(note, 'brand'), null)
  await as(null)
  assert.equal(await judged(approve, 'brand'), null)
})

test('judge asks every op in one read and answers the refused alone', async () => {
  await as(chloe)
  const answered = await judge(db, [approve, reimburse, note], 'brand')
  assert.deepEqual(Object.keys(answered), [approve])
  assert.equal(answered[approve], await refused(chloe, 'judge-approve', 'brand'))
  assert.deepEqual(await judge(db, [], 'brand'), {})
})
