// The surplus allocations alone, on a database holding only the app's core
// and this feat: `account.splits` takes a split that adds up and honours a
// SCOP's floors, loi n° 78-763, art. 33, and refuses one that does not, a
// year not over and one with a period still open; an allocation is made
// once and its split never changes after. Run by `cella test slice
// account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const splits = async (allocation: string) =>
  (await db.query<{ r: string | null }>('SELECT account.splits($1) AS r', [{ allocation }])).rows[0].r

// An allocation and its shares, by percent of the surplus, allocated on
// the verdict date when `allocated` is set.
async function draft(id: string, year: number, surplus: number, shares: Record<string, [number, number]>) {
  await db.query(`INSERT INTO account.allocation (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'salary')`, [id, year, surplus])
  for (const [kind, [percent, cents]] of Object.entries(shares)) {
    await db.query('INSERT INTO account.share (allocation, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [id, kind, percent, cents])
  }
  await db.query('UPDATE account.allocation SET allocated = cella.verdict_date() WHERE id = $1', [id])
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('transaction', 'member', 'account_transaction')`)
  assert.deepEqual(rows, [])
})

test('Lanterne\'s 2025 split adds up and honours the floors', async () => {
  await draft('al-2025', 2025, 61_400_00, {
    work: [45, 27_630_00],
    legal: [15, 9_210_00],
    development: [25, 15_350_00],
    interest: [15, 9_210_00],
  })
  assert.equal(await splits('al-2025'), null)
})

test('an allocation is made once, and its split never changes after', async () => {
  await assert.rejects(db.query(`UPDATE account.allocation SET allocated = '2026-10-25' WHERE id = 'al-2025'`), /the 2025 surplus was allocated on 2026-10-24/)
  await assert.rejects(db.query(`UPDATE account.share SET percent = 50 WHERE allocation = 'al-2025' AND kind = 'work'`), /the split of al-2025 is allocated/)
})

test('a split under the law\'s floors is refused, citing the article', async () => {
  await draft('al-2021', 2021, 100_000_00, { work: [20, 20_000_00], legal: [15, 15_000_00], development: [50, 50_000_00], interest: [15, 15_000_00] })
  assert.match((await splits('al-2021')) ?? '', /work share is under 25 % of the surplus \(loi 78-763, art\. 33, 3°\)/)
  await draft('al-2022', 2022, 100_000_00, { work: [50, 50_000_00], legal: [15, 15_000_00], interest: [35, 35_000_00] })
  assert.match((await splits('al-2022')) ?? '', /interest on capital exceeds what it puts in reserve \(loi 78-763, art\. 33, 4°\)/)
  await draft('al-2023', 2023, 100_000_00, { work: [25, 25_000_00], legal: [15, 15_000_00], development: [30, 30_000_00], interest: [30, 30_000_00] })
  assert.match((await splits('al-2023')) ?? '', /interest on capital exceeds the work share/)
})

test('shares that miss the surplus, or their percent, are refused', async () => {
  await draft('al-2020', 2020, 100_000_00, { work: [50, 50_000_00], legal: [50, 49_000_00] })
  assert.match((await splits('al-2020')) ?? '', /al-2020's shares make 9900000 cents, not its surplus of 10000000/)
  await draft('al-2019', 2019, 100_000_00, { work: [50, 60_000_00], legal: [50, 40_000_00] })
  assert.match((await splits('al-2019')) ?? '', /al-2019's legal share is not its percent of the surplus/)
})

test('a year not over, or with a period still open, is not allocated', async () => {
  await draft('al-2026', 2026, 100_000_00, { work: [50, 50_000_00], legal: [50, 50_000_00] })
  assert.equal(await splits('al-2026'), '2026 is not over')
  await db.query(`INSERT INTO account.period (month) VALUES ('2025-12')`)
  assert.equal(await splits('al-2025'), '2025 has a period still open: 2025-12')
  assert.equal(await splits('al-1999'), 'no allocation al-1999')
})
