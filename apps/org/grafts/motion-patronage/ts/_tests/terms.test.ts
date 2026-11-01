// The work share's terms adopted and a distribution approved by motion,
// on a database holding the app's core, the patronage and motion feats
// and this graft: an action to adopt drafted terms is the adoption it asks
// for, and a proposal moving to adopt no such terms is refused; adopting
// the terms cites a motion that moved to adopt them, and approving a
// distribution a motion that moved to approve it, never another; a
// draft moved again, after a motion that failed, is approved by either,
// and a proposal moving to approve no draft is refused.
// That the motion passed is circle-membership-motion's, not migrated here.
// Run by `cella test slice motion-patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ($1, 'ag', 'Terms', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])
const move = (motion: string, n: number, terms: string) =>
  db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, 'patronage', $3)`, [motion, n, { terms }])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO patronage.terms (id, "from", salary, hours, capital) VALUES ('st-2027', 2027, 60, 40, 50)`)
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2025', 2025, cella.amount(100000), 'salary')`)
  await decide('m-1')
  await decide('m-2')
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2', 1, 'distribution', '{"distribution": "2025"}')`)
})

after(async () => {
  await db.end()
})

test('an action to adopt drafted terms is the adoption it asks for', async () => {
  await move('m-1', 1, 'st-2027')
  assert.deepEqual((await db.query(`SELECT terms, motion FROM motion_patronage.adoption`)).rows, [{ terms: 'st-2027', motion: 'm-1' }])
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-1' }), null)
  await decide('m-5')
  await move('m-5', 1, 'st-1999')
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-5' }), 'no terms st-1999 to adopt')
})

test('adopting cites a motion that moved to adopt the terms, never another', async () => {
  assert.equal(await guard('motion_patronage.adopts', { terms: 'st-2027', motion: 'm-1' }), null)
  assert.equal(await guard('motion_patronage.adopts', { terms: 'st-2027', motion: 'm-2' }), 'm-2 does not adopt st-2027')
  assert.equal(await guard('motion_patronage.adopts', { terms: 'st-2027', motion: 'm-9' }), 'no motion m-9')
})

test('approving cites the motion that approves the distribution, never another', async () => {
  assert.equal(await guard('motion_patronage.approves', { distribution: '2025', motion: 'm-2' }), null)
  assert.equal(await guard('motion_patronage.approves', { distribution: '2025', motion: 'm-1' }), 'm-1 does not approve 2025')
  assert.equal(await guard('motion_patronage.approves', { distribution: '2025', motion: 'm-9' }), 'no motion m-9')
})

test('the actions cite a motion, so the roll\'s guard attaches to them, and what follows an approval is judged by the motion that approved it', async () => {
  assert.deepEqual((await db.query(`SELECT op, owner FROM motion.cites WHERE owner = 'motion-patronage' ORDER BY op`)).rows, [
    { op: 'patronage:distribution:approve', owner: 'motion-patronage' },
    { op: 'patronage:distribution:distribute', owner: 'motion-patronage' },
    { op: 'patronage:part:employ', owner: 'motion-patronage' },
    { op: 'patronage:terms:adopt', owner: 'motion-patronage' },
  ])
  assert.deepEqual(
    (await db.query(`SELECT op FROM cella.guard WHERE fn::text = 'motion_patronage.approves(jsonb)' ORDER BY op`)).rows.map((r) => r.op),
    ['patronage:distribution:approve', 'patronage:distribution:distribute', 'patronage:part:employ'],
  )
})

test('a draft moved again is approved by a motion moving to, and a proposal naming no draft is refused', async () => {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2026', 2026, cella.amount(100000), 'salary')`)
  await decide('m-3')
  await decide('m-4')
  const approving = async () => (await db.query(`SELECT motion FROM motion_patronage.approval WHERE distribution = '2026' ORDER BY motion`)).rows
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-3', 1, 'distribution', '{"distribution": "2026"}')`)
  assert.deepEqual(await approving(), [{ motion: 'm-3' }])
  assert.equal(await guard('motion_patronage.asks_to_approve', { motion: 'm-3' }), null)
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-4', 1, 'distribution', '{"distribution": "2026"}')`)
  assert.deepEqual(await approving(), [{ motion: 'm-3' }, { motion: 'm-4' }])
  assert.equal(await guard('motion_patronage.asks_to_approve', { motion: 'm-4' }), null)
  assert.equal(await guard('motion_patronage.approves', { distribution: '2026', motion: 'm-4' }), null)
  assert.equal(await guard('motion_patronage.approves', { distribution: '2026', motion: 'm-1' }), 'm-1 does not approve 2026')
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-4', 2, 'distribution', '{"distribution": "1999"}')`)
  assert.equal(await guard('motion_patronage.asks_to_approve', { motion: 'm-4' }), 'no distribution 1999 to approve')
})
