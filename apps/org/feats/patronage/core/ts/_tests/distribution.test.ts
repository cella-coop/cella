// The distributions alone, on a database holding only the app's core and
// this feat: `patronage.splits` takes a split that adds up and honours a
// SCOP's floors, loi n° 78-763, art. 33, and refuses one that does not and
// a year not over; a split is approved once and never changes after, and
// `patronage.distributes` distributes only an approved one, once. Run by
// `cella test slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const splits = (distribution: string) => guard('patronage.splits', { distribution })

// A distribution and its shares, by percent of the surplus, approved on
// the verdict date.
async function draft(id: string, year: number, surplus: number, shares: Record<string, [number, number]>) {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'salary')`, [id, year, surplus])
  for (const [kind, [percent, cents]] of Object.entries(shares)) {
    await db.query('INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [id, kind, percent, cents])
  }
  await db.query('UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = $1', [id])
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('account', 'transaction', 'membership', 'patronage_transaction')`)
  assert.deepEqual(rows, [])
})

test('Lanterne\'s 2025 split adds up and honours the floors', async () => {
  await draft('2025', 2025, 61_400_00, {
    work: [45, 27_630_00],
    legal: [15, 9_210_00],
    development: [39.27, 24_111_78],
    interest: [0.73, 448_22],
  })
  assert.equal(await splits('2025'), null)
})

test('a split is approved once, and never changes after', async () => {
  await assert.rejects(db.query(`UPDATE patronage.distribution SET approved = '2026-10-25' WHERE id = '2025'`), /the 2025 surplus was approved on 2026-10-24/)
  await assert.rejects(db.query(`UPDATE patronage.distribution SET surplus = cella.amount(1) WHERE id = '2025'`), /the 2025 surplus was approved on 2026-10-24/)
  await assert.rejects(db.query(`UPDATE patronage.share SET percent = 50 WHERE distribution = '2025' AND kind = 'work'`), /the split of 2025 is approved/)
})

test('a split under the law\'s floors is refused, citing the article', async () => {
  await draft('2021', 2021, 100_000_00, { work: [20, 20_000_00], legal: [15, 15_000_00], development: [50, 50_000_00], interest: [15, 15_000_00] })
  assert.match((await splits('2021')) ?? '', /work share is under 25 % of the surplus \(loi 78-763, art\. 33, 3°\)/)
  await draft('2022', 2022, 100_000_00, { work: [50, 50_000_00], legal: [15, 15_000_00], interest: [35, 35_000_00] })
  assert.match((await splits('2022')) ?? '', /interest on capital exceeds what it puts in reserve \(loi 78-763, art\. 33, 4°\)/)
  await draft('2023', 2023, 100_000_00, { work: [25, 25_000_00], legal: [15, 15_000_00], development: [30, 30_000_00], interest: [30, 30_000_00] })
  assert.match((await splits('2023')) ?? '', /interest on capital exceeds the work share/)
})

test('shares that miss the surplus, or their percent, are refused', async () => {
  await draft('2020', 2020, 100_000_00, { work: [50, 50_000_00], legal: [50, 49_000_00] })
  assert.match((await splits('2020')) ?? '', /2020's shares make 9900000 cents, not its surplus of 10000000/)
  await draft('2019', 2019, 100_000_00, { work: [50, 60_000_00], legal: [50, 40_000_00] })
  assert.match((await splits('2019')) ?? '', /2019's legal share is not its percent of the surplus/)
})

test('a year not over is not approved', async () => {
  await draft('2026', 2026, 100_000_00, { work: [50, 50_000_00], legal: [50, 50_000_00] })
  assert.equal(await splits('2026'), '2026 is not over')
  assert.equal(await splits('1999'), 'no distribution 1999')
})

test('only an approved split is distributed, once', async () => {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2013', 2013, cella.amount(100000), 'salary')`)
  await assert.rejects(db.query(`UPDATE patronage.distribution SET distributed = cella.verdict_date() WHERE id = '2013'`), /2013 is not approved by the assembly/)
  assert.equal(await guard('patronage.distributes', { distribution: '2013' }), '2013 is not approved by the assembly')
  assert.equal(await guard('patronage.distributes', { distribution: '2025' }), '2025 was not distributed by this write')
  await db.query(`UPDATE patronage.distribution SET distributed = cella.verdict_date() WHERE id = '2025'`)
  assert.equal(await guard('patronage.distributes', { distribution: '2025' }), null)
  await assert.rejects(db.query(`UPDATE patronage.distribution SET distributed = '2026-10-25' WHERE id = '2025'`), /the 2025 surplus was distributed on 2026-10-24/)
})
