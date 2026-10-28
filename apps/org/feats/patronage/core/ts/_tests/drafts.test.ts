// Drafting alone, on a database holding only the app's core and this
// feat: `patronage.drafts_terms` takes terms drafted as the request says
// that divide the whole work share, and refuses adopted ones;
// `patronage.drafts` takes a year's draft under adopted terms whose shares
// make its whole surplus, and refuses a year with no terms, shares that
// miss 100 % and a split already approved. Run by `cella test
// slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r

const terms = { from: 1951, salary: 60_00, hours: 40_00, equal: 0, capital: 50_00, interest: 3_50 }

// The slice's other tests share the database, so what this one writes is
// rolled back after it.
before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query('BEGIN')
  await db.query(
    `INSERT INTO patronage.terms (id, "from", salary, hours, equal, capital, interest, adopted) VALUES
       ('st-1950', 1950, 100, 0, 0, 50, 3.5, '1950-03-01')`,
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('terms are drafted as the request says, whole, and never once adopted', async () => {
  await db.query(`INSERT INTO patronage.terms (id, "from", salary, hours, equal, capital, interest) VALUES ('st-1951', 1951, 60, 40, 0, 50, 3.5), ('st-1952', 1952, 60, 30, 0, 50, 0)`)
  assert.equal(await rule('patronage.drafts_terms', { ...terms, terms: 'st-1951' }), null)
  assert.equal(await rule('patronage.drafts_terms', { ...terms, terms: 'st-1951', salary: 70_00 }), 'st-1951 were not drafted by this write')
  assert.equal(
    await rule('patronage.drafts_terms', { ...terms, terms: 'st-1952', from: 1952, hours: 30_00, interest: 0 }),
    'st-1952 divide 90.00 % of the work share, not 100 %',
  )
  assert.equal(await rule('patronage.drafts_terms', { ...terms, terms: 'st-1950', from: 1950 }), 'st-1950 were adopted on 1950-03-01')
  assert.equal(await rule('patronage.drafts_terms', { ...terms, terms: 'st-1' }), 'no terms st-1')
})

test('a year is drafted under adopted terms, its shares making its whole surplus, and never once approved', async () => {
  const split = async (id: string, year: number, surplus: number, shares: [string, number, number][]) => {
    await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'salary')`, [id, year, surplus])
    for (const [kind, percent, cents] of shares) {
      await db.query('INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [id, kind, percent, cents])
    }
  }
  await split('1960', 1960, 100_000, [['work', 50, 50_000], ['legal', 49, 49_000]])
  assert.equal(await rule('patronage.drafts', { year: 1960, surplus: 100_000 }), "1960's shares make 99.00 % of its surplus, not 100 %")
  await db.query(`INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ('1960', 'development', 1, cella.amount(1000))`)
  assert.equal(await rule('patronage.drafts', { year: 1960, surplus: 100_000 }), null)
  assert.equal(await rule('patronage.drafts', { year: 1960, surplus: 90_000 }), '1960 was not drafted by this write')
  await split('1901', 1901, 100_000, [['work', 100, 100_000]])
  assert.equal(await rule('patronage.drafts', { year: 1901, surplus: 100_000 }), '1901 has no adopted terms dividing its work share')
  await db.query(`UPDATE patronage.distribution SET approved = '2026-10-20' WHERE id = '1960'`)
  assert.equal(await rule('patronage.drafts', { year: 1960, surplus: 100_000 }), '1960 was approved on 2026-10-20')
  await db.query('SAVEPOINT approved')
  await assert.rejects(db.query(`UPDATE patronage.distribution SET surplus = cella.amount(1) WHERE id = '1960'`), /the 1960 surplus was approved on 2026-10-20/)
  await db.query('ROLLBACK TO approved')
  assert.equal(await rule('patronage.drafts', { year: 1999, surplus: 1 }), 'no distribution for 1999')
})
