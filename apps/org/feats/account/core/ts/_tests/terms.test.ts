// The capital's clauses alone, on a database holding only the app's core
// and this feat: they govern from the latest adopted terms, are stated
// whole, fall due a year apart after the delay, and repay within five
// years; adopted terms never change. Run by `cella test slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('the capital\'s clauses govern from the latest adopted terms, and repay within five years', async () => {
  assert.equal((await one<{ t: string | null }>(`SELECT account.capital_for('2026-10-24') AS t`)).t, null)
  await db.query(
    `INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments) VALUES
       ('t-2030', 2030, cella.amount(5000), 20, 10, 12, 3), ('t-2032', 2032, cella.amount(5000), 1, 12, 48, 3)`,
  )
  await assert.rejects(db.query(`INSERT INTO account.terms (id, "from", share) VALUES ('t-half', 2030, cella.amount(5000))`), /null value in column "minimum"/)
  assert.equal(await rule('account.adopts', { terms: 't-2030' }), 't-2030 were not adopted by this write')
  await db.query(`UPDATE account.terms SET adopted = cella.verdict_date() WHERE id IN ('t-2030', 't-2032')`)
  assert.equal(await rule('account.adopts', { terms: 't-2030' }), null)
  assert.equal(await rule('account.adopts', { terms: 't-2032' }), 't-2032 repay a departing associate 72 months after the exit: a SCOP repays within five years')
  assert.equal(await rule('account.adopts', { terms: 't-1999' }), 'no terms t-1999')
  assert.equal((await one<{ t: string }>(`SELECT account.capital_for('2031-06-01') AS t`)).t, 't-2030')
  assert.equal((await one<{ t: string }>(`SELECT account.capital_for('2033-01-01') AS t`)).t, 't-2032')
  const due = (await db.query(`SELECT n, to_char(due, 'YYYY-MM-DD') AS due FROM account.repayments('t-2030', '2025-11-30')`)).rows
  assert.deepEqual(due, [
    { n: 1, due: '2026-11-30' },
    { n: 2, due: '2027-11-30' },
    { n: 3, due: '2028-11-30' },
  ])
  await assert.rejects(db.query(`UPDATE account.terms SET minimum = 10 WHERE id = 't-2030'`), /t-2030 were adopted on 2026-10-24/)
})
