// Drafting alone, on a database holding only the app's core and this
// feat: `patronage.drafts` takes a year's draft under adopted terms whose shares
// make its whole surplus, and refuses a year with no terms, shares that
// miss 100 % and a split already approved. Run by `cella test
// slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r

// The slice's other tests share the database, so what this one writes is
// rolled back after it.
before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query('BEGIN')
  await db.query(
    `INSERT INTO patronage.terms (id, policy, "from", salary, hours, equal, capital, interest, adopted) VALUES
       ('st-1950', 'st-1950', 1950, 100, 0, 0, 50, 3.5, '1950-03-01')`,
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a year is drafted under adopted terms, its shares making its whole surplus, and never once approved', async () => {
  const split = async (id: string, year: number, surplus: number, shares: [string, number, number][]) => {
    await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'salary')`, [id, year, surplus])
    for (const [kind, percent, cents] of shares) {
      await db.query('INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [id, kind, percent, cents])
    }
  }
  await split('1960', 1960, 100_000, [['work', 50, 50_000], ['legal', 49, 49_000]])
  assert.equal(await guard('patronage.drafts', { year: 1960, surplus: 100_000 }), "1960's shares make 99.00 % of its surplus, not 100 %")
  await db.query(`INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ('1960', 'development', 1, cella.amount(1000))`)
  assert.equal(await guard('patronage.drafts', { year: 1960, surplus: 100_000 }), null)
  assert.equal(await guard('patronage.drafts', { year: 1960, surplus: 90_000 }), '1960 was not drafted by this write')
  await split('1901', 1901, 100_000, [['work', 100, 100_000]])
  assert.equal(await guard('patronage.drafts', { year: 1901, surplus: 100_000 }), '1901 has no adopted terms dividing its work share')
  await db.query(`UPDATE patronage.distribution SET approved = '2026-10-20' WHERE id = '1960'`)
  assert.equal(await guard('patronage.drafts', { year: 1960, surplus: 100_000 }), '1960 was approved on 2026-10-20')
  await db.query('SAVEPOINT approved')
  await assert.rejects(db.query(`UPDATE patronage.distribution SET surplus = cella.amount(1) WHERE id = '1960'`), /the 1960 surplus was approved on 2026-10-20/)
  await db.query('ROLLBACK TO approved')
  assert.equal(await guard('patronage.drafts', { year: 1999, surplus: 1 }), 'no distribution for 1999')
})
