// A distribution in the books, on a database holding the app's core, the
// patronage and transaction feats and this graft: its split posts from the
// year's result to where each share goes, its entry posts exactly that
// and nothing beside it, and the legal reserve takes its 15 % until
// it reaches the highest capital (loi n° 78-763, art. 33, 1°), and the
// interest on capital is at most its terms' rate of the capital (loi n°
// 47-1775, art. 14). Run by `cella test slice patronage-transaction`.

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
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'salary')`, [id, year, surplus])
  for (const [kind, [percent, cents]] of Object.entries(shares)) {
    await db.query('INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [id, kind, percent, cents])
  }
}

const guard = async (fn: string, distribution: string) =>
  (await db.query<{ r: string | null }>(`SELECT patronage_transaction.${fn}($1) AS r`, [{ distribution }])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  // 13 000 € of capital, and 9 000 € of legal reserve: under it.
  await post('2026-07-01', [['4561', 'debit', 13_000_00], ['1013', 'credit', 13_000_00]])
  await post('2026-07-01', [['120', 'debit', 9_000_00], ['1061', 'credit', 9_000_00]])
  // Terms from 2021 that pay at most 3.5 % on the capital.
  await db.query(`INSERT INTO patronage.terms (id, "from", salary, capital, interest, adopted) VALUES ('st-2021', 2021, 100, 50, 3.5, '2021-03-01')`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the patronage and transaction feats and this graft are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('account', 'membership', 'account_transaction')`)
  assert.deepEqual(rows, [])
})

test('a distribution\'s split posts from the year\'s result to where each share goes', async () => {
  await draft('2025', 2025, 61_400_00, { work: [45, 27_630_00], legal: [15, 9_210_00], development: [39.27, 24_111_78], interest: [0.73, 448_22] })
  const { rows } = await db.query(`SELECT account, side, cents FROM patronage_transaction.lines('2025') ORDER BY account`)
  assert.deepEqual(rows, [
    { account: '1061', side: 'credit', cents: '921000' },
    { account: '1068', side: 'credit', cents: '2411178' },
    { account: '120', side: 'debit', cents: '6140000' },
    { account: '424', side: 'credit', cents: '2763000' },
    { account: '457', side: 'credit', cents: '44822' },
  ])
  assert.equal(await guard('reserves', '2025'), null)
})

test('interest on capital is at most its terms\' rate of the capital (loi 47-1775, art. 14)', async () => {
  // 448,22 € on 13 000 €, under the 455 € that 3.5 % allows.
  assert.equal(await guard('interest', '2025'), null)
  await draft('2023', 2023, 100_000_00, { work: [50, 50_000_00], legal: [15, 15_000_00], development: [34.5, 34_500_00], interest: [0.5, 500_00] })
  assert.equal(await guard('interest', '2023'), '2023\'s interest on capital of 50000 cents exceeds the 3.50 % its terms pay on 1300000 cents of capital, 45500 cents (loi 47-1775, art. 14)')
  // A year no terms govern pays no interest at all.
  await draft('2020', 2020, 10_000_00, { work: [50, 5_000_00], legal: [15, 1_500_00], development: [34, 3_400_00], interest: [1, 100_00] })
  assert.equal(await guard('interest', '2020'), '2020\'s interest on capital of 10000 cents exceeds the 0 % its terms pay on 1300000 cents of capital, 0 cents (loi 47-1775, art. 14)')
})

test('under 15 % to the legal reserve is refused while it is under the highest capital', async () => {
  await draft('2024', 2024, 10_000_00, { work: [50, 5_000_00], legal: [10, 1_000_00], development: [40, 4_000_00] })
  assert.equal(await guard('reserves', '2024'), '2024 puts less than 15 % in the legal reserve, which is under the highest capital (loi 78-763, art. 33, 1°)')
})

test('its entry posts exactly the split, dated on the distribution, and nothing beside it', async () => {
  await db.query(`UPDATE patronage.distribution SET approved = '2026-10-24', distributed = '2026-10-24' WHERE id = '2025'`)
  assert.equal(await guard('posted', '2025'), '2025 posted no entry')
  const split: Line[] = [['120', 'debit', 61_400_00], ['424', 'credit', 27_630_00], ['1061', 'credit', 9_210_00], ['1068', 'credit', 24_111_78], ['457', 'credit', 448_22]]
  const short = await post('2026-10-24', [['120', 'debit', 52_190_00], ['424', 'credit', 27_630_00], ['1068', 'credit', 24_111_78], ['457', 'credit', 448_22]])
  await db.query(`INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES ('2025', $1)`, [short])
  assert.equal(await guard('posted', '2025'), `${short} does not post the split of 2025`)
  // The shares the work share buys are credited by writes of their own,
  // so even lines that balance beside the split are refused.
  const more = await post('2026-10-24', [...split, ['424', 'debit', 100_00], ['101301', 'credit', 100_00]])
  await db.query(`UPDATE patronage_transaction.distribution SET entry = $1 WHERE distribution = '2025'`, [more])
  assert.equal(await guard('posted', '2025'), `${more} posts more than the split of 2025`)
  const whole = await post('2026-10-24', split)
  await db.query(`UPDATE patronage_transaction.distribution SET entry = $1 WHERE distribution = '2025'`, [whole])
  assert.equal(await guard('posted', '2025'), null)
})

test('once the legal reserve reaches the highest capital, the 15 % is no longer owed', async () => {
  // The entries above credited the legal reserve twice with 2025's 15 %,
  // over the highest capital, 13 100 €.
  assert.equal(await guard('reserves', '2024'), null)
})
