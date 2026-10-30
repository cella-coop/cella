// The graft's analytical contract, read as the analytics shell reads it,
// on a database holding the app's core, the account and transaction feats
// and this graft: the journal by account and day sums each account's
// lines, a member's capital account summed into its parent's code so no
// row is one member's; it balances, as the journal does; and the role
// reads the views and nothing beneath them, and writes nothing. The
// slice's other tests share the database, so this one keeps to accounts
// and a month of its own. Run by `cella test slice account-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const analytics = new pg.Client({ user: 'cella_analytics' })

type Line = [string, 'debit' | 'credit', number]

async function post(date: string, lines: Line[]) {
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ($1, 'contract') RETURNING id`, [date])
  for (const [i, [account, side, cents]] of lines.entries()) {
    await db.query('INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))', [rows[0].id, i + 1, account, side, cents])
  }
  await db.query('COMMIT')
}

before(async () => {
  await db.connect()
  await analytics.connect()
  await db.query(
    `INSERT INTO account.account (code, label, kind) VALUES ('1019', 'Members'' capital', 'equity'), ('512900', 'Contract bank', 'asset'), ('706900', 'Contract services', 'income')`,
  )
  await db.query(
    `INSERT INTO account.account (code, label, kind, parent, holder) VALUES
       ('101901', 'Amina', 'equity', '1019', 'amina@contract.example'), ('101902', 'Julien', 'equity', '1019', 'julien@contract.example')`,
  )
  await db.query(`INSERT INTO account.period (month) VALUES ('2029-03'), ('2029-04')`)
  // Two members pay in their capital and a client pays for a service, in
  // March 2029; the service again in April.
  await post('2029-03-02', [['512900', 'debit', 300_00], ['101901', 'credit', 100_00], ['101902', 'credit', 200_00]])
  await post('2029-03-05', [['512900', 'debit', 1_250_00], ['706900', 'credit', 1_250_00]])
  await post('2029-04-01', [['512900', 'debit', 50_00], ['706900', 'credit', 50_00]])
})

after(async () => {
  await analytics.end()
  await db.end()
})

const movements = async (month: string) =>
  (
    await analytics.query<{ code: string; debit: string; credit: string }>(
      `SELECT code, sum(debit)::text AS debit, sum(credit)::text AS credit FROM account_transaction.movements
       WHERE month = $1 AND code IN ('1019', '101901', '101902', '512900', '706900') GROUP BY code ORDER BY code`,
      [month],
    )
  ).rows

test('the journal by account sums each account, a capital account into its parent, so no row is a member\'s', async () => {
  assert.deepEqual(await movements('2029-03'), [
    { code: '1019', debit: '0', credit: '30000' },
    { code: '512900', debit: '155000', credit: '0' },
    { code: '706900', debit: '0', credit: '125000' },
  ])
  assert.deepEqual(await movements('2029-04'), [
    { code: '512900', debit: '5000', credit: '0' },
    { code: '706900', debit: '0', credit: '5000' },
  ])
})

// The three sums are read in one statement, so on one snapshot: the
// slice's other tests post to the same database while this one runs.
test('the movements balance, and add up to the journal\'s months and to the balances, to the cent', async () => {
  const sums = (from: string) => `(SELECT json_build_object('debit', sum(debit)::text, 'credit', sum(credit)::text) FROM ${from})`
  const { rows: [r] } = await db.query<Record<'m' | 'j' | 'b', { debit: string; credit: string }>>(
    `SELECT ${sums('account_transaction.movements')} AS m, ${sums('transaction.months')} AS j, ${sums('account_transaction.balance')} AS b`,
  )
  assert.equal(r.m.debit, r.m.credit)
  assert.deepEqual(r.j, r.m)
  assert.deepEqual(r.b, r.m)
})

test('the chart shows the accounts no one holds, and the role reads no table beneath the views', async () => {
  const { rows } = await analytics.query<{ code: string }>(`SELECT code FROM account.chart WHERE code LIKE '1019%' ORDER BY code`)
  assert.deepEqual(rows.map((r) => r.code), ['1019'])
  for (const table of ['transaction.line', 'transaction.entry', 'account.account', 'account_transaction.balance']) {
    await assert.rejects(analytics.query(`SELECT * FROM ${table} LIMIT 1`), /permission denied/, table)
  }
})

test('the role writes nothing: its transactions are read-only', async () => {
  const { rows: [r] } = await analytics.query<{ default_transaction_read_only: string }>('SHOW default_transaction_read_only')
  assert.equal(r.default_transaction_read_only, 'on')
  await assert.rejects(analytics.query(`DELETE FROM account.chart`), /read-only transaction|permission denied|cannot delete/)
})
