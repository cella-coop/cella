// A surplus allocation in the books, on a database holding the app's core,
// the account and transaction feats and this graft: its split posts from
// the year's result to where each share goes, and the legal reserve takes
// its 15 % until it reaches the highest capital (loi n° 78-763, art. 33,
// 1°). Run by `cella test slice account-transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

type Line = [string, 'debit' | 'credit', number]

async function post(date: string, lines: Line[]): Promise<string> {
  await db.query('BEGIN')
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ($1, 'slice') RETURNING id`, [date])
  for (const [i, [account, side, cents]] of lines.entries()) {
    await db.query('INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))', [rows[0].id, i + 1, account, side, cents])
  }
  await db.query('COMMIT')
  return rows[0].id
}

async function draft(id: string, year: number, surplus: number, shares: Record<string, [number, number]>) {
  await db.query(`INSERT INTO account.allocation (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'salary')`, [id, year, surplus])
  for (const [kind, [percent, cents]] of Object.entries(shares)) {
    await db.query('INSERT INTO account.share (allocation, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [id, kind, percent, cents])
  }
}

const reserves = async (allocation: string) =>
  (await db.query<{ r: string | null }>('SELECT account_transaction.reserves($1) AS r', [{ allocation }])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO account.account (code, label, kind) VALUES
       ('1013', 'Capital', 'equity'), ('1061', 'Legal reserve', 'equity'), ('1068', 'Development fund', 'equity'),
       ('120', 'Result', 'equity'), ('424', 'Work share', 'liability'), ('457', 'Interest', 'liability'), ('4561', 'Owed', 'asset')`,
  )
  await db.query(`INSERT INTO account.period (month) VALUES ('2026-07'), ('2026-10')`)
  // 13 000 € of capital, and 9 000 € of legal reserve: under it.
  await post('2026-07-01', [['4561', 'debit', 13_000_00], ['1013', 'credit', 13_000_00]])
  await post('2026-07-01', [['120', 'debit', 9_000_00], ['1061', 'credit', 9_000_00]])
})

after(async () => {
  await db.end()
})

test('an allocation\'s split posts from the year\'s result to where each share goes', async () => {
  await draft('al-2025', 2025, 61_400_00, { work: [45, 27_630_00], legal: [15, 9_210_00], development: [25, 15_350_00], interest: [15, 9_210_00] })
  const { rows } = await db.query(`SELECT account, side, cents FROM account_transaction.allocation_lines('al-2025') ORDER BY account`)
  assert.deepEqual(rows, [
    { account: '1061', side: 'credit', cents: '921000' },
    { account: '1068', side: 'credit', cents: '1535000' },
    { account: '120', side: 'debit', cents: '6140000' },
    { account: '424', side: 'credit', cents: '2763000' },
    { account: '457', side: 'credit', cents: '921000' },
  ])
  assert.equal(await reserves('al-2025'), null)
})

test('under 15 % to the legal reserve is refused while it is under the highest capital', async () => {
  await draft('al-2024', 2024, 10_000_00, { work: [50, 5_000_00], legal: [10, 1_000_00], development: [40, 4_000_00] })
  assert.equal(await reserves('al-2024'), 'al-2024 puts less than 15 % in the legal reserve, which is under the highest capital (loi 78-763, art. 33, 1°)')
})

test('once the legal reserve reaches the highest capital, the 15 % is no longer owed', async () => {
  // A member left and was repaid: the capital fell to 12 000 €, but its
  // highest stays 13 000 €; the reserve must reach that.
  await post('2026-10-01', [['1013', 'debit', 1_000_00], ['4561', 'credit', 1_000_00]])
  await post('2026-10-01', [['120', 'debit', 3_500_00], ['1061', 'credit', 3_500_00]])
  assert.match((await reserves('al-2024')) ?? '', /under the highest capital/)
  await post('2026-10-02', [['120', 'debit', 500_00], ['1061', 'credit', 500_00]])
  assert.equal(await reserves('al-2024'), null)
})
