// A distribution in the books, on a database holding the app's core, the
// patronage and transaction feats and this graft: its split posts from the
// year's result to where each share goes, its entry posts exactly that
// and what balances beside it, and the legal reserve takes its 15 % until
// it reaches the highest capital (loi n° 78-763, art. 33, 1°). Run by
// `cella test slice patronage-transaction`.

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

const rule = async (fn: string, distribution: string) =>
  (await db.query<{ r: string | null }>(`SELECT patronage_transaction.${fn}($1) AS r`, [{ distribution }])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  // 13 000 € of capital, and 9 000 € of legal reserve: under it.
  await post('2026-07-01', [['4561', 'debit', 13_000_00], ['1013', 'credit', 13_000_00]])
  await post('2026-07-01', [['120', 'debit', 9_000_00], ['1061', 'credit', 9_000_00]])
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the patronage and transaction feats and this graft are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('account', 'member', 'account_transaction')`)
  assert.deepEqual(rows, [])
})

test('a distribution\'s split posts from the year\'s result to where each share goes', async () => {
  await draft('2025', 2025, 61_400_00, { work: [45, 27_630_00], legal: [15, 9_210_00], development: [25, 15_350_00], interest: [15, 9_210_00] })
  const { rows } = await db.query(`SELECT account, side, cents FROM patronage_transaction.lines('2025') ORDER BY account`)
  assert.deepEqual(rows, [
    { account: '1061', side: 'credit', cents: '921000' },
    { account: '1068', side: 'credit', cents: '1535000' },
    { account: '120', side: 'debit', cents: '6140000' },
    { account: '424', side: 'credit', cents: '2763000' },
    { account: '457', side: 'credit', cents: '921000' },
  ])
  assert.equal(await rule('reserves', '2025'), null)
})

test('under 15 % to the legal reserve is refused while it is under the highest capital', async () => {
  await draft('2024', 2024, 10_000_00, { work: [50, 5_000_00], legal: [10, 1_000_00], development: [40, 4_000_00] })
  assert.equal(await rule('reserves', '2024'), '2024 puts less than 15 % in the legal reserve, which is under the highest capital (loi 78-763, art. 33, 1°)')
})

test('its entry posts the split, dated on the distribution, and only what balances away from the result beside it', async () => {
  await db.query(`UPDATE patronage.distribution SET approved = '2026-10-24', distributed = '2026-10-24' WHERE id = '2025'`)
  assert.equal(await rule('posted', '2025'), '2025 posted no entry')
  const split: Line[] = [['120', 'debit', 61_400_00], ['424', 'credit', 27_630_00], ['1061', 'credit', 9_210_00], ['1068', 'credit', 15_350_00], ['457', 'credit', 9_210_00]]
  const short = await post('2026-10-24', [['120', 'debit', 52_190_00], ['424', 'credit', 27_630_00], ['1068', 'credit', 15_350_00], ['457', 'credit', 9_210_00]])
  await db.query(`INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES ('2025', $1)`, [short])
  assert.equal(await rule('posted', '2025'), `${short} does not post the split of 2025`)
  const more = await post('2026-10-24', [...split, ['424', 'debit', 100_00], ['101301', 'credit', 50_00], ['120', 'credit', 50_00]])
  await db.query(`UPDATE patronage_transaction.distribution SET entry = $1 WHERE distribution = '2025'`, [more])
  assert.equal(await rule('posted', '2025'), `${more} posts more than the split of 2025, and not in balance away from the result`)
  const whole = await post('2026-10-24', [...split, ['424', 'debit', 100_00], ['101301', 'credit', 100_00]])
  await db.query(`UPDATE patronage_transaction.distribution SET entry = $1 WHERE distribution = '2025'`, [whole])
  assert.equal(await rule('posted', '2025'), null)
})

test('once the legal reserve reaches the highest capital, the 15 % is no longer owed', async () => {
  // The entries above credited the legal reserve twice with 2025's 15 %:
  // 27 420 €, over the highest capital, 13 150 €.
  assert.equal(await rule('reserves', '2024'), null)
})
