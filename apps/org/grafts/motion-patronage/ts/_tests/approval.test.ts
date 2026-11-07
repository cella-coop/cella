// A distribution approved by motion, on a database holding the app's
// core, the motion and patronage feats and this graft: approving cites the
// motion that moved to approve it, never another; a draft moved again is
// approved by either motion moving to, and a proposal moving to approve
// no draft is refused; both actions cite a motion. That the motion passed
// is membership-motion's, not migrated here. Run by `cella test
// slice motion-patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline) VALUES ($1, 'ag', 'camille@lanterne.example', 'Split', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2025', 2025, cella.amount(100000), 'salary')`)
  await decide('m-11')
  await decide('m-12')
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-12', 1, 'distribution', '{"distribution": "2025"}')`)
})

after(async () => {
  await db.end()
})

test('approving cites the motion that approves the distribution, never another', async () => {
  assert.equal(await guard('motion_patronage.approves', { distribution: '2025', motion: 'm-12' }), null)
  assert.equal(await guard('motion_patronage.approves', { distribution: '2025', motion: 'm-11' }), 'm-11 does not approve 2025')
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
  await decide('m-13')
  await decide('m-14')
  const approving = async () => (await db.query(`SELECT motion FROM motion_patronage.approval WHERE distribution = '2026' ORDER BY motion`)).rows
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-13', 1, 'distribution', '{"distribution": "2026"}')`)
  assert.deepEqual(await approving(), [{ motion: 'm-13' }])
  assert.equal(await guard('motion_patronage.asks_to_approve', { motion: 'm-13' }), null)
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-14', 1, 'distribution', '{"distribution": "2026"}')`)
  assert.deepEqual(await approving(), [{ motion: 'm-13' }, { motion: 'm-14' }])
  assert.equal(await guard('motion_patronage.asks_to_approve', { motion: 'm-14' }), null)
  assert.equal(await guard('motion_patronage.approves', { distribution: '2026', motion: 'm-14' }), null)
  assert.equal(await guard('motion_patronage.approves', { distribution: '2026', motion: 'm-11' }), 'm-11 does not approve 2026')
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-14', 2, 'distribution', '{"distribution": "1999"}')`)
  assert.equal(await guard('motion_patronage.asks_to_approve', { motion: 'm-14' }), 'no distribution 1999 to approve')
})
