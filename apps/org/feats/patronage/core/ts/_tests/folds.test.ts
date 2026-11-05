// The patronage feat's folds (`sql/009-folds.sql`), on a database holding
// the app's core and this feat, each test in a transaction rolled back
// after, on one verdict date, which a transaction reads once: terms
// adopted by the SQL their handler runs, a split drafted from the
// percents its entry keeps, approved with the parts it keeps, each figure
// as its commitment, and distributed on the entry's day. Run by `cella
// test slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const day = '2041-03-01'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, payload: unknown) => db.query(`SELECT patronage.${fn}($1)`, [{ n, op, actor: sacha, date: day, cause: null, payload }])
const rule =
  'The work share is divided {patronage_salary: 100 % | more is stricter} by pay, {patronage_hours: 0 % | more is stricter} by time worked ' +
  'and {patronage_equal: 0 % | more is stricter} in equal parts; {patronage_capital: 50 % | more is stricter} of an associate\'s part buys shares, ' +
  'and capital earns at most {patronage_interest: 3.5 % | less is stricter}'
const adopted = async (motion: string) =>
  (await one<{ id: string }>(`SELECT policy.adopt('ag', 'rule', $1, NULL, $2, 1, '2040-01-01'::date, NULL, NULL) AS id`, [rule, motion])).id

// Each test's entries fold on `day`, as `cella.fold_log` sets the clock
// to an entry's, in a transaction rolled back after it.
async function folding(body: () => Promise<void>) {
  await db.query('BEGIN')
  try {
    await db.query(`SELECT set_config('cella.clock', $1, true)`, [day])
    await body()
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('terms fold by the rule the entry names, and refuse a rule that makes other terms', () =>
  folding(async () => {
    await fold('fold_adopt', 1, 'patronage:terms:adopt', { policy: await adopted('m-2041-001'), motion: 'm-2041-001', terms: 'm-2041-001-1', adopted: day })
    assert.deepEqual(await one(`SELECT "from", salary::float8 AS salary FROM patronage.terms WHERE id = 'm-2041-001-1'`), { from: 2040, salary: 100 })
    const other = await adopted('m-2041-002')
    await assert.rejects(fold('fold_adopt', 2, 'patronage:terms:adopt', { policy: other, terms: 'elsewhere' }), /entry 2 adopts elsewhere from m-2041-002\/1, but its rule makes m-2041-002-1/)
  }))

test('a split folds as drafted, approved with its parts as their commitments, and distributed on the entry\'s day', () =>
  folding(async () => {
    await fold('fold_adopt', 1, 'patronage:terms:adopt', { policy: await adopted('m-2041-001'), terms: 'm-2041-001-1' })
    const draft = { year: 2040, surplus: 100_000_00, work: 2500, legal: 1500, development: 6000, interest: 0, distribution: '2040' }
    await fold('fold_draft', 2, 'patronage:distribution:draft', { ...draft, surplus: 90_000_00 })
    await fold('fold_draft', 3, 'patronage:distribution:draft', draft)
    assert.deepEqual(await one(`SELECT cella.cents(surplus) AS surplus, basis FROM patronage.distribution WHERE id = '2040'`), { surplus: '10000000', basis: 'salary' })
    assert.deepEqual((await db.query(`SELECT kind, cella.cents(amount) AS cents FROM patronage.share WHERE distribution = '2040' ORDER BY kind`)).rows, [
      { kind: 'development', cents: '6000000' },
      { kind: 'legal', cents: '1500000' },
      { kind: 'work', cents: '2500000' },
    ])
    await fold('fold_approve', 4, 'patronage:distribution:approve', { distribution: '2040', approved: day, parts: [{ worker: sacha, basis: 'salary', quantity: commitment, amount: commitment }] })
    assert.deepEqual(await one(`SELECT worker, basis, quantity, amount FROM patronage.part WHERE distribution = '2040'`), { worker: sacha, basis: 'salary', quantity: null, amount: null })
    assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field LIKE 'patronage.part.%' AND subject = $1`, [sacha])).n, '2')
    await fold('fold_distribute', 5, 'patronage:distribution:distribute', { distribution: '2040' })
    assert.deepEqual(await one(`SELECT to_char(approved, 'YYYY-MM-DD') AS approved, to_char(distributed, 'YYYY-MM-DD') AS distributed FROM patronage.distribution WHERE id = '2040'`), {
      approved: day,
      distributed: day,
    })
  }))
