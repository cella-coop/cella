// The patronage-transaction graft's fold (`sql/004-folds.sql`), on a
// database holding the app's core, the patronage and transaction feats
// and this graft, in a transaction rolled back after: a distribution
// folds the entry posting the split, as its payload keeps it, linked to
// the distribution, and refuses one that keeps none. Run by `cella test
// slice patronage-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const entry = (n: number, payload: unknown) => ({ n, op: 'patronage:distribution:distribute', actor: 'julien@folded.example', date: '2041-03-02', cause: null, payload })

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a distribution folds the entry posting its split, linked to it', async () => {
  // The next id is read under the counter's lock, so a sibling test file's
  // post waits for this file's rollback rather than taking the number.
  const { id } = (await db.query<{ id: string }>(`SELECT 'je-' || lpad((last + 1)::text, 4, '0') AS id FROM transaction.journal FOR UPDATE`)).rows[0]
  const posting = { date: '2041-03-02', label: 'Distribution of the 2040 surplus', lines: [{ account: '120', side: 'debit', cents: 500_00 }, { account: '424', side: 'credit', cents: 500_00 }] }
  await db.query('SELECT patronage_transaction.fold_distribute($1)', [entry(1, { distribution: '2040', entry: id, posting })])
  assert.deepEqual((await db.query('SELECT distribution, entry FROM patronage_transaction.distribution WHERE entry = $1', [id])).rows, [{ distribution: '2040', entry: id }])
  assert.equal((await db.query('SELECT count(*)::int AS n FROM transaction.line WHERE entry = $1', [id])).rows[0].n, 2)
  await db.query('SAVEPOINT refused')
  await assert.rejects(db.query('SELECT patronage_transaction.fold_distribute($1)', [entry(2, { distribution: '2041', entry: 'je-9999' })]), /entry 2 keeps no posting of 2041/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
