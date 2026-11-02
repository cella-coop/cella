// Whose an expense is, on a database holding the app's core, the expense
// and membership feats and this graft: each claim is named for the person
// who made it, member or not, since claiming is every employee's right
// and no guard of this graft's refuses one. Run by
// `cella test slice expense-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO person.person (address, name) VALUES ('amina@x', 'Amina'), ('ines@x', 'Inès')`)
  await db.query(`INSERT INTO membership.member (address, status, since) VALUES ('amina@x', 'active', '2024-01-10'), ('ines@x', 'invited', NULL)`)
  await db.query(
    `INSERT INTO expense.expense (id, member, day, label, category, net, status, submitted, decided, decider) VALUES
       ('ex-0001', 'ines@x', '2026-10-20', 'Train to Clairval', '6251', '42', 'approved', '2026-10-21', '2026-10-22', 'amina@x')`,
  )
})

after(async () => {
  await db.end()
})

test('a claim is named for its claimant, an invited worker\'s as a member\'s, and for who decided it', async () => {
  const { rows } = await db.query('SELECT expense, name, decider_name FROM expense_membership.claim')
  assert.deepEqual(rows, [{ expense: 'ex-0001', name: 'Inès', decider_name: 'Amina' }])
})

test('no guard of this graft\'s is on the capture, and no trigger on the expenses', async () => {
  const guards = await db.query(`SELECT op FROM cella.guard WHERE owner = 'expense-membership'`)
  assert.deepEqual(guards.rows, [])
  const triggers = await db.query(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'expense.expense'::regclass AND NOT tgisinternal AND tgname = 'whose'`)
  assert.deepEqual(triggers.rows, [])
})
