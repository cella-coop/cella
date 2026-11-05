// The expense-project graft's fold (`sql/002-folds.sql`), on a database
// holding the app's core, the expense and project feats and this graft,
// in a transaction rolled back after: an expense folds filed under the
// project its entry names, a later filing replacing it. Run by `cella
// test slice expense-project`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const fold = (n: number, payload: unknown) =>
  db.query('SELECT expense_project.fold_rebill($1)', [{ n, op: 'expense-project:expense:rebill', actor: 'sofia@folded.example', date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an expense folds filed under its entry\'s project, the last filing winning', async () => {
  await fold(1, { expense: 'ex-9901', project: 'pr-9901' })
  await fold(2, { expense: 'ex-9901', project: 'pr-9902' })
  assert.deepEqual((await db.query(`SELECT expense, project FROM expense_project.rebill WHERE expense = 'ex-9901'`)).rows, [
    { expense: 'ex-9901', project: 'pr-9902' },
  ])
})
