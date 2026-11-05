// The account-transaction graft's fold (`sql/006-folds.sql`), on a
// database holding the app's core, the account and transaction feats and
// this graft, in a transaction rolled back after: an entry carried over
// folds the accounts it asked to open that the chart lacked, as `opening`
// opened them, then the entry as the journal keeps it. Run by `cella test
// slice account-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO account.period (month) VALUES ('2041-01') ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO account.account (code, label, kind) VALUES ('401', 'Suppliers', 'liability'), ('606', 'Supplies', 'expense') ON CONFLICT DO NOTHING`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a carried entry folds the accounts the chart lacked, then the entry', async () => {
  // The next id is read under the counter's lock, so a sibling test file's
  // post waits for this file's rollback rather than taking the number.
  const { id } = (await db.query<{ id: string }>(`SELECT 'je-' || lpad((last + 1)::text, 4, '0') AS id FROM transaction.journal FOR UPDATE`)).rows[0]
  const payload = {
    entry: id,
    date: '2041-01-31',
    label: 'Carried over: paper',
    lines: [
      { account: '6064', side: 'debit', cents: 45_00 },
      { account: '401', side: 'credit', cents: 45_00 },
    ],
    accounts: [
      { code: '6064', label: 'Office supplies' },
      { code: '401', label: 'Never relabelled' },
    ],
    opened: ['6064'],
  }
  await db.query('SELECT account_transaction.fold_carry($1)', [{ n: 1, op: 'account-transaction:entry:carry', actor: 'julien@folded.example', date: '2041-02-01', cause: null, payload }])
  assert.deepEqual((await db.query(`SELECT code, label, kind, parent FROM account.account WHERE code IN ('401', '6064') ORDER BY code`)).rows, [
    { code: '401', label: 'Suppliers', kind: 'liability', parent: null },
    { code: '6064', label: 'Office supplies', kind: 'expense', parent: '606' },
  ])
  assert.deepEqual((await db.query(`SELECT e.label, l.account, l.side, cella.cents(l.amount) AS cents FROM transaction.entry e JOIN transaction.line l ON l.entry = e.id WHERE e.id = $1 ORDER BY l.n`, [id])).rows, [
    { label: 'Carried over: paper', account: '6064', side: 'debit', cents: '4500' },
    { label: 'Carried over: paper', account: '401', side: 'credit', cents: '4500' },
  ])
})
