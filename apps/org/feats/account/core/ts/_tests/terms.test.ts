// The capital's clauses alone, on a database holding only the app's core
// and this feat: they are copied from a capital rule's values, refused
// where those make no terms; they govern from the day their rule applies
// until later terms do, fall due a year apart after the delay, and repay
// within five years; adopted terms never change. Run by `cella test slice
// account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const flaw = async (legal: string) => (await one<{ f: string | null }>('SELECT account.terms_flaw((SELECT jsonb_object_agg(m.name, m.literal) FROM policy.marks($1) m)) AS f', [legal])).f

const capital = (share: string, minimum: number, delay: number, repayments: number) =>
  `A share is worth {account_share: ${share} | more is stricter}; each associate subscribes at least {account_minimum: ${minimum} | more is stricter} shares, ` +
  `paid in at most {account_instalments: 10 | less is stricter} monthly instalments; one who leaves is repaid from {account_delay: ${delay} | more is stricter} months ` +
  `after the exit, in {account_repayments: ${repayments} | more is stricter} yearly repayments`

const adopt = async (legal: string, n: number, applies: string) => {
  const { rows } = await db.query<{ id: string }>(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-020', $2, $3::date, NULL, NULL) AS id`, [legal, n, applies])
  return (await one<{ t: string | null }>('SELECT account.terms_from($1) AS t', [rows[0].id])).t
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('a capital rule marks the five clauses, and repays within five years', async () => {
  assert.equal(await flaw(capital('50 €', 20, 12, 3)), null)
  assert.equal(await flaw('Remote work is at most {remote: 3 | less is stricter} days a week'), 'the capital\'s terms mark account_share too')
  assert.match((await flaw(capital('50 €', 20, 12, 3) + ', and {account_rate: 2 % | less is stricter}')) ?? '', /not account_rate/)
  assert.match((await flaw(capital('fifty', 20, 12, 3))) ?? '', /account_share is the value of a share, an amount/)
  assert.match((await flaw(capital('50 €', 0, 12, 3))) ?? '', /account_minimum is the fewest shares/)
  assert.equal(await flaw(capital('50 €', 1, 48, 3)), 'the capital\'s terms repay a departing associate 72 months after the exit: a SCOP repays within five years')
})

test('the capital\'s clauses are copied from the rule, and govern from the day it applies until later terms do', async () => {
  await db.query('BEGIN')
  try {
    assert.equal((await one<{ t: string | null }>(`SELECT account.capital_for('2026-10-24') AS t`)).t, null)
    assert.equal(await adopt('Remote work is at most {remote: 3 | less is stricter} days a week', 1, '2026-10-24'), null, 'a rule of no value of this feat\'s makes no terms')
    assert.equal(await adopt(capital('50 €', 20, 12, 3), 2, '2030-01-01'), 'm-2026-020-2')
    assert.equal(await adopt(capital('25 €', 10, 12, 3), 3, '2032-06-01'), 'm-2026-020-3')
    assert.deepEqual(
      await one(`SELECT policy, to_char("from", 'YYYY-MM-DD') AS "from", cella.cents(share)::int AS share, minimum, instalments, delay, repayments FROM account.terms WHERE id = 'm-2026-020-3'`),
      { policy: 'm-2026-020/3', from: '2032-06-01', share: 2500, minimum: 10, instalments: 10, delay: 12, repayments: 3 },
    )
    assert.equal(await guard('account.adopts', { policy: 'm-2026-020/2', terms: 'm-2026-020-2' }), null)
    assert.equal(await guard('account.adopts', { policy: 'm-2026-020/2', terms: 'm-2026-020-3' }), 'm-2026-020-2 were not adopted by this write')
    assert.equal(await guard('account.adopts', { policy: 'm-2026-020/9' }), 'no terms copy m-2026-020/9')
    assert.equal((await one<{ t: string }>(`SELECT account.capital_for('2031-06-01') AS t`)).t, 'm-2026-020-2')
    assert.equal((await one<{ t: string }>(`SELECT account.capital_for('2032-05-31') AS t`)).t, 'm-2026-020-2')
    assert.equal((await one<{ t: string }>(`SELECT account.capital_for('2032-06-01') AS t`)).t, 'm-2026-020-3')
    const due = (await db.query(`SELECT n, to_char(due, 'YYYY-MM-DD') AS due FROM account.repayments('m-2026-020-2', '2025-11-30')`)).rows
    assert.deepEqual(due, [
      { n: 1, due: '2026-11-30' },
      { n: 2, due: '2027-11-30' },
      { n: 3, due: '2028-11-30' },
    ])
    await db.query('SAVEPOINT s')
    await assert.rejects(adopt(capital('50 €', 1, 48, 3), 4, '2033-01-01'), /a SCOP repays within five years/)
    await db.query('ROLLBACK TO SAVEPOINT s')
    await assert.rejects(db.query(`UPDATE account.terms SET minimum = 5 WHERE id = 'm-2026-020-2'`), /m-2026-020-2 were adopted on 2026-10-24/)
  } finally {
    await db.query('ROLLBACK')
  }
})
