// The work share's terms adopted and a distribution approved by decision,
// on a database holding the app's core, the patronage and decision feats
// and this graft: a motion to adopt drafted terms is the adoption it asks
// for, and a proposal moving to adopt no such terms is refused; adopting
// the terms cites a decision that moved to adopt them, and approving a
// distribution a decision that moved to approve it, never another; a
// draft moved again, after a decision that failed, is approved by either,
// and a proposal moving to approve no draft is refused.
// That the decision passed is circle-decision-membership's, not migrated here.
// Run by `cella test slice decision-patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline) VALUES ($1, 'ag', 'Terms', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])
const move = (decision: string, n: number, terms: string) =>
  db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ($1, $2, 'patronage', $3)`, [decision, n, { terms }])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO patronage.terms (id, "from", salary, hours, capital) VALUES ('st-2027', 2027, 60, 40, 50)`)
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2025', 2025, cella.amount(100000), 'salary')`)
  await decide('d-1')
  await decide('d-2')
  await db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ('d-2', 1, 'distribution', '{"distribution": "2025"}')`)
})

after(async () => {
  await db.end()
})

test('a motion to adopt drafted terms is the adoption it asks for', async () => {
  await move('d-1', 1, 'st-2027')
  assert.deepEqual((await db.query(`SELECT terms, decision FROM decision_patronage.adoption`)).rows, [{ terms: 'st-2027', decision: 'd-1' }])
  assert.equal(await rule('decision_patronage.asks', { decision: 'd-1' }), null)
  await decide('d-5')
  await move('d-5', 1, 'st-1999')
  assert.equal(await rule('decision_patronage.asks', { decision: 'd-5' }), 'no terms st-1999 to adopt')
})

test('adopting cites a decision that moved to adopt the terms, never another', async () => {
  assert.equal(await rule('decision_patronage.adopts', { terms: 'st-2027', decision: 'd-1' }), null)
  assert.equal(await rule('decision_patronage.adopts', { terms: 'st-2027', decision: 'd-2' }), 'd-2 does not adopt st-2027')
  assert.equal(await rule('decision_patronage.adopts', { terms: 'st-2027', decision: 'd-9' }), 'no decision d-9')
})

test('approving cites the decision that approves the distribution, never another', async () => {
  assert.equal(await rule('decision_patronage.approves', { distribution: '2025', decision: 'd-2' }), null)
  assert.equal(await rule('decision_patronage.approves', { distribution: '2025', decision: 'd-1' }), 'd-1 does not approve 2025')
  assert.equal(await rule('decision_patronage.approves', { distribution: '2025', decision: 'd-9' }), 'no decision d-9')
})

test('both ops cite a decision, so the roll\'s rule attaches to them', async () => {
  assert.deepEqual((await db.query(`SELECT op, owner FROM decision.cites WHERE owner = 'decision-patronage' ORDER BY op`)).rows, [
    { op: 'patronage:distribution:approve', owner: 'decision-patronage' },
    { op: 'patronage:terms:adopt', owner: 'decision-patronage' },
  ])
})

test('a draft moved again is approved by a decision moving to, and a proposal naming no draft is refused', async () => {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2026', 2026, cella.amount(100000), 'salary')`)
  await decide('d-3')
  await decide('d-4')
  const approving = async () => (await db.query(`SELECT decision FROM decision_patronage.approval WHERE distribution = '2026' ORDER BY decision`)).rows
  await db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ('d-3', 1, 'distribution', '{"distribution": "2026"}')`)
  assert.deepEqual(await approving(), [{ decision: 'd-3' }])
  assert.equal(await rule('decision_patronage.asks_to_approve', { decision: 'd-3' }), null)
  await db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ('d-4', 1, 'distribution', '{"distribution": "2026"}')`)
  assert.deepEqual(await approving(), [{ decision: 'd-3' }, { decision: 'd-4' }])
  assert.equal(await rule('decision_patronage.asks_to_approve', { decision: 'd-4' }), null)
  assert.equal(await rule('decision_patronage.approves', { distribution: '2026', decision: 'd-4' }), null)
  assert.equal(await rule('decision_patronage.approves', { distribution: '2026', decision: 'd-1' }), 'd-1 does not approve 2026')
  await db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ('d-4', 2, 'distribution', '{"distribution": "1999"}')`)
  assert.equal(await rule('decision_patronage.asks_to_approve', { decision: 'd-4' }), 'no distribution 1999 to approve')
})
