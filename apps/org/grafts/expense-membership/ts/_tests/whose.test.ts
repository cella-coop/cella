// Whose an expense is, on a database holding the app's core, the expense
// and membership feats and this graft: the rule on a capture refuses an
// expense of anyone but an active member on the verdict date. Run by
// `cella test slice expense-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const whose = async (member: string) =>
  (await db.query<{ r: string | null }>('SELECT expense_membership.whose($1) AS r', [{ member, day: '2026-10-20' }])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO person.person (address, name) VALUES ('amina@x', 'Amina'), ('basile@x', 'Basile'), ('ines@x', 'Inès')`)
  await db.query(
    `INSERT INTO membership.member (address, status, since, suspended) VALUES
       ('amina@x', 'active', '2024-01-10', NULL),
       ('basile@x', 'suspended', '2024-01-10', '2025-06-01'),
       ('ines@x', 'invited', NULL, NULL)`,
  )
})

after(async () => {
  await db.end()
})

test('an active member claims an expense', async () => {
  assert.equal(await whose('amina@x'), null)
})

test('one suspended, one only invited and someone who is no member claim none', async () => {
  for (const member of ['basile@x', 'ines@x', 'nobody@x']) {
    assert.match((await whose(member)) ?? '', new RegExp(`${member} is no active member: an expense is claimed by one`))
  }
})

test('the rule runs on the capture, and no trigger of this graft\'s is on the expenses', async () => {
  const { rows } = await db.query(`SELECT op FROM cella.rule WHERE fn = 'expense_membership.whose(jsonb)'::regprocedure`)
  assert.deepEqual(rows, [{ op: 'expense:expense:capture' }])
  const triggers = await db.query(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'expense.expense'::regclass AND tgname = 'whose'`)
  assert.deepEqual(triggers.rows, [])
})
