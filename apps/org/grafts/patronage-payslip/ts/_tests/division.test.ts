// The work share divided by pay and in equal parts, on a database holding
// the app's core, the patronage and payslip feats and this graft: a mix of
// the two divides each portion among those paid that year, to the cent,
// a worker who left counting only the months before;
// approving makes the parts in that write, and the guard takes them, and
// refuses parts that are no longer what the year's pay gives. Run by
// `cella test slice patronage-payslip`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const rows = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r

async function draft(id: string, year: number, work: number) {
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), 'mix')`, [id, year, work * 2])
  await db.query(`INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, 'work', 50, cella.amount($2)), ($1, 'legal', 50, cella.amount($2))`, [id, work])
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO patronage.terms (id, policy, "from", salary, equal, capital, adopted) VALUES ('t-2020', 't-2020', 2020, 75, 25, 50, '2020-01-10')`)
  // Ana is paid 3 000 € all year; Ben 1 500 € from July, so 9 000 € in 2025.
  await db.query(
    `INSERT INTO payslip.salary (member, "from", gross) VALUES
       ('ana@x', '2025-01-01', cella.amount(300000)), ('ben@x', '2025-07-01', cella.amount(150000))`,
  )
  await draft('2025', 2025, 10_000_00)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the patronage and payslip feats and this graft are migrated', async () => {
  assert.deepEqual(await rows(`SELECT nspname FROM pg_namespace WHERE nspname IN ('timesheet', 'membership', 'patronage_timesheet')`), [])
})

test('the pay portion divides by what each was paid that year, the equal portion one part each', async () => {
  assert.deepEqual(await rows(`SELECT worker, basis, quantity, cents FROM patronage_payslip.division('2025') ORDER BY basis, worker`), [
    { worker: 'ana@x', basis: 'equal', quantity: '1', cents: '125000' },
    { worker: 'ben@x', basis: 'equal', quantity: '1', cents: '125000' },
    { worker: 'ana@x', basis: 'salary', quantity: '3600000', cents: '600000' },
    { worker: 'ben@x', basis: 'salary', quantity: '900000', cents: '150000' },
  ])
  assert.deepEqual(await rows(`SELECT member, amount FROM patronage_payslip.work_share WHERE distribution = '2025' ORDER BY member`), [
    { member: 'ana@x', amount: '600000' },
    { member: 'ben@x', amount: '150000' },
  ])
})

test('a worker who left on 30 November counts eleven months, and one who left the year before none', async () => {
  await db.query('BEGIN')
  try {
    // Dee is paid 1 200 € until 30 November 2025; Eve left on 31 December 2024.
    await db.query(
      `INSERT INTO payslip.salary (member, "from", until, gross) VALUES
         ('dee@x', '2025-01-01', '2025-11-30', cella.amount(120000)), ('eve@x', '2023-01-01', '2024-12-31', cella.amount(200000))`,
    )
    assert.deepEqual(await rows(`SELECT member, cents FROM patronage_payslip.basis(2025) ORDER BY member`), [
      { member: 'ana@x', cents: '3600000' },
      { member: 'ben@x', cents: '900000' },
      { member: 'dee@x', cents: '1320000' },
    ])
    assert.deepEqual(await rows(`SELECT worker, basis, quantity FROM patronage_payslip.division('2025') ORDER BY basis, worker`), [
      { worker: 'ana@x', basis: 'equal', quantity: '1' },
      { worker: 'ben@x', basis: 'equal', quantity: '1' },
      { worker: 'dee@x', basis: 'equal', quantity: '1' },
      { worker: 'ana@x', basis: 'salary', quantity: '3600000' },
      { worker: 'ben@x', basis: 'salary', quantity: '900000' },
      { worker: 'dee@x', basis: 'salary', quantity: '1320000' },
    ])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('approving makes the parts in that write, which both guards take', async () => {
  await db.query(`UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = '2025'`)
  assert.deepEqual(await rows(`SELECT worker, basis, cella.cents(amount) AS cents FROM patronage.part WHERE distribution = '2025' ORDER BY basis, worker`), [
    { worker: 'ana@x', basis: 'equal', cents: '125000' },
    { worker: 'ben@x', basis: 'equal', cents: '125000' },
    { worker: 'ana@x', basis: 'salary', cents: '600000' },
    { worker: 'ben@x', basis: 'salary', cents: '150000' },
  ])
  assert.equal(await guard('patronage_payslip.divides', { distribution: '2025' }), null)
  assert.equal(await guard('patronage.divides', { distribution: '2025' }), null)
})

test('parts no longer what the year\'s pay gives are refused', async () => {
  await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ('cleo@x', '2025-12-01', cella.amount(200000))`)
  assert.equal(await guard('patronage_payslip.divides', { distribution: '2025' }), '2025\'s parts by pay and in equal parts are not its work share divided among those paid in 2025')
})
