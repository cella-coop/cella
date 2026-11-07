// The account-membership-patronage-transaction graft's fold
// (`sql/005-folds.sql`), on a database holding the app's core, the feats
// it joins and their lower grafts and this one, in a transaction rolled
// back after: a part employed in shares folds the entry, the credit as
// its entry keeps it and the shares added to what the member holds, on
// the entry's day. Run by `cella test slice
// account-membership-patronage-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`SELECT set_config('cella.clock', '2041-03-03', true)`)
  await db.query(`INSERT INTO account.period (month) VALUES ('2041-03') ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO account.account (code, label, kind) VALUES ('1013', 'Capital', 'equity'), ('424', 'Work share owed', 'liability') ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Sacha')`, [sacha])
  await db.query(`INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2030-01-01', 20)`, [sacha])
  await db.query(`INSERT INTO account.account (code, label, kind, parent, holder) VALUES ('101399', 'Capital — Sacha', 'equity', '1013', $1)`, [sacha])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a part employed in shares folds its entry, its credit and the shares it buys', async () => {
  // The next id is read under the counter's lock, so a sibling test file's
  // post waits for this file's rollback rather than taking the number.
  const { id } = (await db.query<{ id: string }>(`SELECT 'je-' || lpad((last + 1)::text, 4, '0') AS id FROM transaction.journal FOR UPDATE`)).rows[0]
  const posting = { date: '2041-03-03', label: 'Work share 2040 employed in shares, 101399', lines: [{ account: '424', side: 'debit', cents: 300_00 }, { account: '101399', side: 'credit', cents: 300_00 }] }
  const payload = { distribution: '2040', member: sacha, entry: id, motion: 'm-2041-001', account: '101399', shares: 6, amount: 300_00, until: '2046-03-03', posting }
  await db.query('SELECT account_membership_patronage_transaction.fold_employ($1)', [{ n: 1, op: 'patronage:part:employ', actor: 'julien@folded.example', date: '2041-03-03', cause: null, payload }])
  assert.deepEqual(
    (await db.query(`SELECT account, shares, cella.cents(amount) AS cents, to_char(until, 'YYYY-MM-DD') AS until, entry FROM account_membership_patronage_transaction.credit WHERE member = $1`, [sacha])).rows,
    [{ account: '101399', shares: 6, cents: '30000', until: '2046-03-03', entry: id }],
  )
  assert.equal((await db.query('SELECT shares FROM membership.member WHERE address = $1', [sacha])).rows[0].shares, 26)
})
