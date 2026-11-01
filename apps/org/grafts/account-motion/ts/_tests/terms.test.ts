// Capital terms adopted by motion, on a database holding the app's
// core, the account and motion feats and this graft: an action to adopt
// drafted terms is the adoption it asks for, and a proposal moving to adopt
// no such terms is refused; adopting the terms cites a motion that
// moved to adopt them, never another. That the motion passed is
// circle-membership-motion's, not migrated here. Run by `cella test slice
// account-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ($1, 'ag', 'Terms', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])
const move = (motion: string, n: number, terms: string) =>
  db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, 'terms', $3)`, [motion, n, { terms }])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments) VALUES ('st-2027', 2027, cella.amount(5000), 20, 10, 12, 3)`)
  await decide('m-1')
  await decide('m-2')
})

after(async () => {
  await db.end()
})

test('an action to adopt drafted terms is the adoption it asks for', async () => {
  await move('m-1', 1, 'st-2027')
  assert.deepEqual((await db.query(`SELECT terms, motion FROM account_motion.adoption`)).rows, [{ terms: 'st-2027', motion: 'm-1' }])
  assert.equal(await guard('account_motion.asks', { motion: 'm-1' }), null)
  await move('m-2', 1, 'st-1999')
  assert.equal(await guard('account_motion.asks', { motion: 'm-2' }), 'no terms st-1999 to adopt')
})

test('adopting cites a motion that moved to adopt the terms, never another', async () => {
  assert.equal(await guard('account_motion.adopts', { terms: 'st-2027', motion: 'm-1' }), null)
  assert.equal(await guard('account_motion.adopts', { terms: 'st-2027', motion: 'm-2' }), 'm-2 does not adopt st-2027')
  assert.equal(await guard('account_motion.adopts', { terms: 'st-2027', motion: 'm-9' }), 'no motion m-9')
})

test('the op cites a motion, so the roll\'s guard attaches to it', async () => {
  assert.deepEqual((await db.query(`SELECT owner FROM motion.cites WHERE op = 'account:terms:adopt'`)).rows, [{ owner: 'account-motion' }])
})
