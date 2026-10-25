// The financial statements from a small journal, on a database holding the
// app's core, the account and transaction feats and this graft: the income
// statement sums a span's entries rubric by rubric and its result is the
// income less the expenses; the balance sheet sums every entry up to the
// span's end and balances, its period's result the income statement's;
// a line's accounts add up to it. The slice's other tests share the
// database, so this one keeps to accounts and months of its own, leaves the
// capital the legal reserve is held to alone, and reads the balance sheet's
// movement over its months in one statement. Run by
// `cella test slice account-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

type Line = [string, 'debit' | 'credit', number]

async function post(date: string, lines: Line[]) {
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ($1, 'slice') RETURNING id`, [date])
  for (const [i, [account, side, cents]] of lines.entries()) {
    await db.query('INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))', [rows[0].id, i + 1, account, side, cents])
  }
  await db.query('COMMIT')
}

const income = async (since: string, until: string) =>
  Object.fromEntries(
    (await db.query<{ id: string; amount: string | null }>(`SELECT id, amount FROM account_transaction.statement('income', $1, $2)`, [since, until])).rows.map(
      (r) => [r.id, r.amount === null ? null : Number(r.amount)],
    ),
  )

// The balance sheet at the end of 2026 and at the end of each of this
// test's months, read at once, so a post by another test lands in all or
// none.
async function balances() {
  const { rows } = await db.query<{ id: string; dec: string | null; jan: string | null; feb: string | null }>(
    `SELECT d.id, d.amount AS dec, j.amount AS jan, f.amount AS feb
     FROM account_transaction.statement('balance', NULL, '2026-12-31') d
     JOIN account_transaction.statement('balance', NULL, '2027-01-31') j USING (id)
     JOIN account_transaction.statement('balance', NULL, '2027-02-28') f USING (id)`,
  )
  return Object.fromEntries(rows.map((r) => [r.id, { dec: Number(r.dec), jan: Number(r.jan), feb: Number(r.feb) }]))
}

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO account.account (code, label, kind) VALUES
       ('1641', 'Bank loan', 'liability'), ('4111', 'Clients', 'asset'), ('445711', 'VAT collected', 'liability'),
       ('5121', 'Bank', 'asset'), ('6132', 'Rent', 'expense'), ('6411', 'Wages', 'expense'), ('7061', 'Services', 'income')`,
  )
  await db.query(`INSERT INTO account.period (month) VALUES ('2027-01'), ('2027-02')`)
  // A loan paid in, an invoice and its payment, the rent and the wages
  // in January; another invoice in February.
  await post('2027-01-01', [['5121', 'debit', 10_000_00], ['1641', 'credit', 10_000_00]])
  await post('2027-01-03', [['4111', 'debit', 12_000_00], ['7061', 'credit', 10_000_00], ['445711', 'credit', 2_000_00]])
  await post('2027-01-20', [['5121', 'debit', 12_000_00], ['4111', 'credit', 12_000_00]])
  await post('2027-01-05', [['6132', 'debit', 1_500_00], ['5121', 'credit', 1_500_00]])
  await post('2027-01-28', [['6411', 'debit', 6_000_00], ['5121', 'credit', 6_000_00]])
  await post('2027-02-10', [['4111', 'debit', 6_000_00], ['7061', 'credit', 5_000_00], ['445711', 'credit', 1_000_00]])
})

after(async () => {
  await db.end()
})

test('the income statement sums the span\'s entries, its result the income less the expenses', async () => {
  const january = await income('2027-01-01', '2027-01-31')
  assert.equal(january['production-sold'], 10_000_00)
  assert.equal(january.external, 1_500_00)
  assert.equal(january.wages, 6_000_00)
  assert.equal(january['operating-income-total'], 10_000_00)
  assert.equal(january['operating-expenses-total'], 7_500_00)
  assert.equal(january['operating-result'], 2_500_00)
  assert.equal(january.result, 2_500_00)
  assert.equal(january['operating-income'], null, 'a heading has no figure')
  const february = await income('2027-02-01', '2027-02-28')
  assert.equal(february.result, 5_000_00)
  const both = await income('2027-01-01', '2027-02-28')
  assert.equal(both.result, january.result + february.result)
})

test('the balance sheet sums every entry up to the span\'s end, and balances', async () => {
  const s = await balances()
  for (const at of ['dec', 'jan', 'feb'] as const) {
    assert.equal(s['assets-total'][at], s['liabilities-total'][at], at)
  }
  const moved = (id: string, at: 'jan' | 'feb') => s[id][at] - s[id].dec
  assert.equal(moved('period-result', 'jan'), 2_500_00)
  assert.equal(moved('period-result', 'feb'), 7_500_00)
  assert.equal(moved('bank-loans', 'feb'), 10_000_00)
  assert.equal(moved('cash', 'feb'), 14_500_00)
  assert.equal(moved('receivables', 'feb'), 6_000_00)
  assert.equal(moved('tax-social', 'feb'), 3_000_00)
  assert.equal(moved('assets-total', 'feb'), 20_500_00)
})

test('a line\'s accounts add up to it', async () => {
  const { rows } = await db.query<{ rubric: string; amount: string; line: string }>(
    `WITH f AS (SELECT * FROM account_transaction.figures('balance', NULL, '2027-02-28')),
          s AS (SELECT * FROM account_transaction.statement('balance', NULL, '2027-02-28'))
     SELECT s.id AS rubric, coalesce(sum(f.amount), 0)::bigint AS amount, s.amount AS line
     FROM s LEFT JOIN f ON f.rubric = s.id WHERE s.kind = 'line' GROUP BY s.id, s.amount`,
  )
  assert.ok(rows.length > 0)
  for (const r of rows) {
    assert.equal(r.amount, r.line, r.rubric)
  }
  const { rows: result } = await db.query(
    `SELECT code, amount FROM account_transaction.figures('income', '2027-01-01', '2027-01-31') ORDER BY code`,
  )
  assert.deepEqual(result, [
    { code: '6132', amount: '150000' },
    { code: '6411', amount: '600000' },
    { code: '7061', amount: '1000000' },
  ])
})
