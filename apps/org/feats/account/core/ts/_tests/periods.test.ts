// The periods alone, on a database holding only the app's core and this
// feat: `account.opens` takes a month that keeps the books' months
// following one another, after the latest or before the first, and
// refuses one that leaves a gap or names no period. Run by `cella test
// slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const opens = async (month: string) => (await db.query<{ r: string | null }>('SELECT account.opens($1) AS r', [{ month }])).rows[0].r
const open = (month: string) => db.query('INSERT INTO account.period (month) VALUES ($1) ON CONFLICT DO NOTHING', [month])

// The slice's other tests share the database, so what this one writes is
// rolled back after it.
before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query('DELETE FROM account.period')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('the first month opens alone, and each next one after the latest', async () => {
  await open('2026-11')
  assert.equal(await opens('2026-11'), null)
  await open('2026-12')
  await open('2027-01')
  assert.equal(await opens('2027-01'), null)
  await open('2027-01')
  assert.equal(await opens('2027-01'), null, 'opening a month twice changes nothing')
})

test('a month that leaves a gap is refused, and one that names no period', async () => {
  await open('2027-03')
  assert.equal(await opens('2027-03'), '2027-03 leaves a gap in the periods, which follow one another from 2026-11 to 2027-03')
  await db.query(`DELETE FROM account.period WHERE month = '2027-03'`)
  assert.equal(await opens('2027-04'), 'no period 2027-04')
})
