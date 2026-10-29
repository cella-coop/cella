// Capital terms adopted by decision, on a database holding the app's
// core, the account and decision feats and this graft: a motion to adopt
// drafted terms is the adoption it asks for, and a proposal moving to adopt
// no such terms is refused; adopting the terms cites a decision that
// moved to adopt them, never another. That the decision passed is
// circle-decision-membership's, not migrated here. Run by `cella test slice
// account-decision`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline) VALUES ($1, 'ag', 'Terms', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])
const move = (decision: string, n: number, terms: string) =>
  db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ($1, $2, 'terms', $3)`, [decision, n, { terms }])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments) VALUES ('st-2027', 2027, cella.amount(5000), 20, 10, 12, 3)`)
  await decide('d-1')
  await decide('d-2')
})

after(async () => {
  await db.end()
})

test('a motion to adopt drafted terms is the adoption it asks for', async () => {
  await move('d-1', 1, 'st-2027')
  assert.deepEqual((await db.query(`SELECT terms, decision FROM account_decision.adoption`)).rows, [{ terms: 'st-2027', decision: 'd-1' }])
  assert.equal(await rule('account_decision.asks', { decision: 'd-1' }), null)
  await move('d-2', 1, 'st-1999')
  assert.equal(await rule('account_decision.asks', { decision: 'd-2' }), 'no terms st-1999 to adopt')
})

test('adopting cites a decision that moved to adopt the terms, never another', async () => {
  assert.equal(await rule('account_decision.adopts', { terms: 'st-2027', decision: 'd-1' }), null)
  assert.equal(await rule('account_decision.adopts', { terms: 'st-2027', decision: 'd-2' }), 'd-2 does not adopt st-2027')
  assert.equal(await rule('account_decision.adopts', { terms: 'st-2027', decision: 'd-9' }), 'no decision d-9')
})

test('the op cites a decision, so the roll\'s rule attaches to it', async () => {
  assert.deepEqual((await db.query(`SELECT owner FROM decision.cites WHERE op = 'account:terms:adopt'`)).rows, [{ owner: 'account-decision' }])
})
