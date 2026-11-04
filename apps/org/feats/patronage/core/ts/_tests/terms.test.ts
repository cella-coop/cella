// The work share's terms and its parts alone, on a database holding only
// the app's core and this feat: the terms governing a year, what they
// divide by, and each basis's portion to the cent; terms are copied from a
// work share rule, and `patronage.adopts` refuses terms that divide less
// than the whole or would govern a year already approved; `patronage.divides` takes parts that add up to each
// portion and refuses those that miss it or a basis the terms do not
// name; parts are made only in the write that approves, and never change,
// each basis the terms weigh divided by the division registered for it
// and one none divides refused. Run by `cella test slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R

// A distribution of a year's surplus, its work share half of it and the
// rest to the reserves, approved on the verdict date.
async function approved(id: string, year: number, surplus: number, basis: string) {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), $4)`, [id, year, surplus, basis])
  await db.query(
    `INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, 'work', 50, cella.amount($2)), ($1, 'legal', 50, cella.amount($2))`,
    [id, surplus / 2],
  )
  await db.query('UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = $1', [id])
}

const part = (distribution: string, worker: string, basis: string, quantity: number, cents: number) =>
  db.query(`INSERT INTO patronage.part (distribution, worker, basis, quantity, amount) VALUES ($1, $2, $3, $4, cella.amount($5))`, [distribution, worker, basis, quantity, cents])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(
    `INSERT INTO patronage.terms (id, policy, "from", salary, hours, equal, capital, adopted) VALUES
       ('t-2010', 't-2010', 2010, 100, 0, 0, 0, '2010-01-15'),
       ('t-2016', 't-2016', 2016, 50, 30, 20, 50, '2016-03-01')`,
  )
})

after(async () => {
  await db.end()
})

test('the terms governing a year are the adopted ones from the latest year not after it', async () => {
  assert.deepEqual(await one(`SELECT patronage.terms_for(2015) AS a, patronage.terms_for(2018) AS b, patronage.terms_for(2009) AS c`), { a: 't-2010', b: 't-2016', c: null })
  assert.deepEqual(await one(`SELECT patronage.basis_of('t-2010') AS a, patronage.basis_of('t-2016') AS b`), { a: 'salary', b: 'mix' })
})

test('each basis divides its weight of the work share, and the portions add up to it to the cent', async () => {
  await approved('2018', 2018, 100_000_00, 'mix')
  const p = await one<{ salary: string; hours: string; equal: string; work: string }>(
    `SELECT patronage.portion('2018', 'salary') AS salary, patronage.portion('2018', 'hours') AS hours,
            patronage.portion('2018', 'equal') AS equal, patronage.share_of('2018', 'work') AS work`,
  )
  assert.equal(Number(p.salary) + Number(p.hours) + Number(p.equal), Number(p.work))
  assert.deepEqual([p.salary, p.hours, p.equal], ['2500000', '1500000', '1000000'])
})

test('parts that add up to each portion pass; one missing, or a basis the terms do not name, is refused', async () => {
  assert.equal(await guard('patronage.divides', { distribution: '2018' }), '2018\'s parts by salary make 0 cents, not its portion of 2500000')
  await part('2018', 'a@x', 'salary', 300_000_00, 15_000_00)
  await part('2018', 'b@x', 'salary', 200_000_00, 10_000_00)
  await part('2018', 'a@x', 'hours', 90_000, 9_000_00)
  await part('2018', 'b@x', 'hours', 60_000, 6_000_00)
  await part('2018', 'a@x', 'equal', 1, 5_000_00)
  assert.equal(await guard('patronage.divides', { distribution: '2018' }), '2018\'s parts by equal make 500000 cents, not its portion of 1000000')
  await part('2018', 'b@x', 'equal', 1, 5_000_00)
  assert.equal(await guard('patronage.divides', { distribution: '2018' }), null)
  assert.deepEqual(await one(`SELECT amount, salary, hours, equal FROM patronage.statement WHERE id = '2018:a@x'`), {
    amount: '2900000',
    salary: '1500000',
    hours: '900000',
    equal: '500000',
  })

  await approved('2017', 2017, 10_000_00, 'salary')
  assert.equal(await guard('patronage.divides', { distribution: '2017' }), '2017 divides its work share by salary, not by mix as t-2016 say')
})

test('parts are made in the write that approves, and never change', async () => {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2014', 2014, cella.amount(100000), 'salary')`)
  await assert.rejects(part('2014', 'a@x', 'salary', 1, 100), /the parts of 2014 are made when it is approved, and never change/)
  await assert.rejects(db.query(`UPDATE patronage.part SET amount = cella.amount(1) WHERE distribution = '2018'`), /never change/)
  await assert.rejects(db.query(`DELETE FROM patronage.part WHERE distribution = '2018'`), /never change/)
})

const work = (salary: string, hours: string, from = '2027-01-01') => ({ salary, hours, from })
const rule = (w: { salary: string; hours: string }) =>
  `The work share is divided {patronage_salary: ${w.salary} | more is stricter} by pay, {patronage_hours: ${w.hours} | more is stricter} by time worked ` +
  'and {patronage_equal: 0 % | more is stricter} in equal parts; {patronage_capital: 50 % | more is stricter} of an associate\'s part buys shares, ' +
  'and capital earns at most {patronage_interest: 3.5 % | less is stricter}'
const flaw = async (legal: string) =>
  (await one<{ f: string | null }>('SELECT patronage.terms_flaw((SELECT jsonb_object_agg(m.name, m.literal) FROM policy.marks($1) m)) AS f', [legal])).f

test('a work share rule marks the five shares, and divides the whole of it', async () => {
  assert.equal(await flaw(rule(work('60 %', '40 %'))), null)
  assert.equal(await flaw(rule(work('60 %', '30 %'))), 'the work share\'s terms divide 90 % of the work share, not 100 %')
  assert.match((await flaw(rule(work('60', '40 %')))) ?? '', /patronage_salary is a share of at most all, as 50 %, not 60/)
  assert.equal(await flaw('Remote work is at most {remote_days: 3 | less is stricter} days a week'), 'the work share\'s terms mark patronage_salary too')
})

test('terms are copied from the rule, never over a year already approved, and never change after', async () => {
  await db.query('BEGIN')
  try {
    const adopt = async (legal: string, n: number, applies: string) => {
      const { rows } = await db.query<{ id: string }>(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-020', $2, $3::date, NULL, NULL) AS id`, [legal, n, applies])
      return (await one<{ t: string | null }>('SELECT patronage.terms_from($1) AS t', [rows[0].id])).t
    }
    assert.equal(await adopt('Remote work is at most {remote_days: 3 | less is stricter} days a week', 1, '2026-10-24'), null, 'a rule of no value of this feat\'s makes no terms')
    assert.equal(await adopt(rule(work('60 %', '40 %')), 2, '2027-01-01'), 'm-2026-020-2')
    assert.deepEqual(
      await one(`SELECT policy, "from", salary::float8 AS salary, hours::float8 AS hours, equal::float8 AS equal, capital::float8 AS capital, interest::float8 AS interest FROM patronage.terms WHERE id = 'm-2026-020-2'`),
      { policy: 'm-2026-020/2', from: 2027, salary: 60, hours: 40, equal: 0, capital: 50, interest: 3.5 },
    )
    assert.equal(await guard('patronage.adopts', { policy: 'm-2026-020/2', terms: 'm-2026-020-2' }), null)
    assert.equal(await guard('patronage.copies', { policy: 'm-2026-020/2' }), null)
    assert.equal(await guard('patronage.adopts', { policy: 'm-2026-020/9' }), 'no terms copy m-2026-020/9')
    assert.equal(await adopt(rule(work('100 %', '0 %')), 3, '2018-01-01'), 'm-2026-020-3')
    assert.equal(await guard('patronage.adopts', { policy: 'm-2026-020/3', terms: 'm-2026-020-3' }), 'm-2026-020-3 would govern 2018, whose distribution is approved')
    await db.query('SAVEPOINT s')
    await assert.rejects(adopt(rule(work('60 %', '30 %')), 4, '2028-01-01'), /divide 90 % of the work share, not 100 %/)
    await db.query('ROLLBACK TO SAVEPOINT s')
    await assert.rejects(db.query(`UPDATE patronage.terms SET capital = 10 WHERE id = 'm-2026-020-2'`), /m-2026-020-2 were adopted on 2026-10-24/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('approving makes each weighed basis\'s parts as the division registered for it answers, and refuses a basis none divides', async () => {
  await db.query('BEGIN')
  try {
    // An extender's division of pay and of equal parts, and one of time
    // worked that also answers a row by pay, which its basis's rows alone
    // keep out.
    await db.query(`CREATE SCHEMA extender`)
    await db.query(
      `CREATE FUNCTION extender.by_pay(ref text) RETURNS TABLE (worker text, basis text, quantity bigint, cents bigint) LANGUAGE sql AS $$
         VALUES ('a@x', 'salary', 300000::bigint, patronage.portion(ref, 'salary')), ('a@x', 'equal', 1::bigint, patronage.portion(ref, 'equal'))
       $$`,
    )
    await db.query(
      `CREATE FUNCTION extender.by_time(ref text) RETURNS TABLE (worker text, basis text, quantity bigint, cents bigint) LANGUAGE sql AS $$
         VALUES ('b@x', 'hours', 600::bigint, patronage.portion(ref, 'hours')), ('b@x', 'salary', 1::bigint, 1::bigint)
       $$`,
    )
    await db.query(`SELECT patronage.register_division('salary', 'extender.by_pay(text)'), patronage.register_division('equal', 'extender.by_pay(text)')`)
    await approved('2024', 2024, 20_000_00, 'mix')
    await db.query('SAVEPOINT s')
    await assert.rejects(
      db.query(`SELECT patronage.divide('2024')`),
      (e: Error & { code?: string }) => e.code === '09000' && /2024 divides its work share by hours, which no division is registered for/.test(e.message),
    )
    await db.query('ROLLBACK TO SAVEPOINT s')
    await db.query(`SELECT patronage.register_division('hours', 'extender.by_time(text)')`)
    await db.query(`SELECT patronage.divide('2024')`)
    assert.deepEqual((await db.query(`SELECT worker, basis, quantity, cella.cents(amount) AS cents FROM patronage.part WHERE distribution = '2024' ORDER BY basis, worker`)).rows, [
      { worker: 'a@x', basis: 'equal', quantity: '1', cents: '200000' },
      { worker: 'b@x', basis: 'hours', quantity: '600', cents: '300000' },
      { worker: 'a@x', basis: 'salary', quantity: '300000', cents: '500000' },
    ])
    assert.equal(await guard('patronage.divides', { distribution: '2024' }), null)
  } finally {
    await db.query('ROLLBACK')
  }
})
