// The account feat's folds (`sql/011-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// month opened and closed on its entry's day, a holder's accounts frozen
// as the entry names them, and the writes it publishes, an account opened
// under the longest code that begins its own and a capital account whose
// label is its commitment. Run by `cella test slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, payload: unknown) =>
  db.query(`SELECT account.${fn}($1)`, [{ n, op, actor: sacha, date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a month folds open, then closed on its entry\'s day; one open already stays as it is', async () => {
  await fold('fold_open', 1, 'account:period:open', { month: '2041-01' })
  await fold('fold_open', 2, 'account:period:open', { month: '2041-01' })
  await fold('fold_close', 3, 'account:period:close', { month: '2041-01', closed: '2041-02-03' })
  assert.deepEqual(await one(`SELECT to_char(closed, 'YYYY-MM-DD') AS closed FROM account.period WHERE month = '2041-01'`), { closed: '2041-02-03' })
})

test('an account folds open of its class under its parent, a capital account with its label as its commitment, and a freeze freezes what the entry names', async () => {
  await db.query(`INSERT INTO account.account (code, label, kind) VALUES ('1099', 'Capital, folded', 'equity')`)
  await db.query(`SELECT account.fold_opening('10991', 'Capital, folded, sub')`)
  await db.query(`SELECT account.fold_holding(4, '1099101', '10991', $1, $2)`, [sacha, commitment])
  assert.deepEqual((await db.query(`SELECT code, label, kind, parent, holder FROM account.account WHERE code LIKE '1099%' ORDER BY code`)).rows, [
    { code: '1099', label: 'Capital, folded', kind: 'equity', parent: null, holder: null },
    { code: '10991', label: 'Capital, folded, sub', kind: 'equity', parent: '1099', holder: null },
    { code: '1099101', label: 'redacted', kind: 'equity', parent: '10991', holder: sacha },
  ])
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'account.account.label' AND subject = $1`, [sacha])).n, '1')
  await db.query('SAVEPOINT refused')
  await assert.rejects(db.query(`SELECT account.fold_holding(5, '9999901', '99999', $1, $2)`, [sacha, commitment]), /entry 5 opens 9999901 under 99999, which the chart does not hold/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
  await fold('fold_freeze', 6, 'account:own:freeze', { holder: sacha, accounts: ['1099101'] })
  assert.deepEqual(await one(`SELECT frozen FROM account.account WHERE code = '1099101'`), { frozen: true })
})
