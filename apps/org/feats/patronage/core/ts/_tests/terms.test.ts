// The work share's terms and its parts alone, on a database holding only
// the app's core and this feat: the terms governing a year, what they
// divide by, and each basis's portion to the cent; `patronage.adopts`
// refuses terms that divide less than the whole or would govern a year
// already approved; `patronage.divides` takes parts that add up to each
// portion and refuses those that miss it or a basis the terms do not
// name; parts are made only in the write that approves, and never change.
// Run by `cella test slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
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
    `INSERT INTO patronage.terms (id, "from", salary, hours, equal, capital, adopted) VALUES
       ('t-2010', 2010, 100, 0, 0, 0, '2010-01-15'),
       ('t-2016', 2016, 50, 30, 20, 50, '2016-03-01')`,
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
  assert.equal(await rule('patronage.divides', { distribution: '2018' }), '2018\'s parts by salary make 0 cents, not its portion of 2500000')
  await part('2018', 'a@x', 'salary', 300_000_00, 15_000_00)
  await part('2018', 'b@x', 'salary', 200_000_00, 10_000_00)
  await part('2018', 'a@x', 'hours', 90_000, 9_000_00)
  await part('2018', 'b@x', 'hours', 60_000, 6_000_00)
  await part('2018', 'a@x', 'equal', 1, 5_000_00)
  assert.equal(await rule('patronage.divides', { distribution: '2018' }), '2018\'s parts by equal make 500000 cents, not its portion of 1000000')
  await part('2018', 'b@x', 'equal', 1, 5_000_00)
  assert.equal(await rule('patronage.divides', { distribution: '2018' }), null)
  assert.deepEqual(await one(`SELECT amount, salary, hours, equal FROM patronage.statement WHERE id = '2018:a@x'`), {
    amount: '2900000',
    salary: '1500000',
    hours: '900000',
    equal: '500000',
  })

  await approved('2017', 2017, 10_000_00, 'salary')
  assert.equal(await rule('patronage.divides', { distribution: '2017' }), '2017 divides its work share by salary, not by mix as t-2016 say')
})

test('parts are made in the write that approves, and never change', async () => {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2014', 2014, cella.amount(100000), 'salary')`)
  await assert.rejects(part('2014', 'a@x', 'salary', 1, 100), /the parts of 2014 are made when it is approved, and never change/)
  await assert.rejects(db.query(`UPDATE patronage.part SET amount = cella.amount(1) WHERE distribution = '2018'`), /never change/)
  await assert.rejects(db.query(`DELETE FROM patronage.part WHERE distribution = '2018'`), /never change/)
})

test('terms are adopted whole, never over a year already approved, and never change after', async () => {
  await db.query(`INSERT INTO patronage.terms (id, "from", salary, hours) VALUES ('t-2019', 2019, 60, 30), ('t-2018', 2018, 100, 0), ('t-2027', 2027, 70, 30)`)
  assert.equal(await rule('patronage.adopts', { terms: 't-2027' }), 't-2027 were not adopted by this write')
  await db.query(`UPDATE patronage.terms SET adopted = cella.verdict_date() WHERE id IN ('t-2019', 't-2018', 't-2027')`)
  assert.equal(await rule('patronage.adopts', { terms: 't-2019' }), 't-2019 divide 90.00 % of the work share, not 100 %')
  assert.equal(await rule('patronage.adopts', { terms: 't-2018' }), 't-2018 would govern 2018, whose distribution is approved')
  assert.equal(await rule('patronage.adopts', { terms: 't-2027' }), null)
  assert.equal(await rule('patronage.adopts', { terms: 't-1999' }), 'no terms t-1999')
  await assert.rejects(db.query(`UPDATE patronage.terms SET capital = 10 WHERE id = 't-2027'`), /t-2027 were adopted on 2026-10-24/)
})
