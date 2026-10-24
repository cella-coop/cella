// The payslips alone, on a database holding only the app's core and this
// feat: what each salaried member is due, from the salary in force and
// the terms' rates; a run prepared with exactly that; a run approved and
// paid once, its payslips fixed from its approval; and the pay ratio.
// Run by `cella test slice payslip`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(run(), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

const rule = async (fn: string, payload: object) =>
  (await db.query<{ r: string | null }>(`SELECT payslip.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-02'`)
  await db.query(`INSERT INTO payslip.terms (employee, employer, ratio) VALUES (22, 40, 1.6)`)
  await db.query(
    `INSERT INTO payslip.salary (member, "from", gross) VALUES
       ('camille@lanterne.example', '2025-01-01', cella.amount(300000)),
       ('chloe@lanterne.example', '2025-01-01', cella.amount(240000)),
       ('chloe@lanterne.example', '2026-11-01', cella.amount(250000))`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('member', 'timesheet', 'transaction')`)
  assert.deepEqual(rows, [])
})

test('each salaried member is due the salary in force on the month\'s first day, less 22 %, with 40 % on top', async () => {
  const { rows } = await db.query(`SELECT member, gross, employee, employer, net FROM payslip.due('2026-10') ORDER BY member`)
  assert.deepEqual(rows, [
    { member: 'camille@lanterne.example', gross: '300000', employee: '66000', employer: '120000', net: '234000' },
    { member: 'chloe@lanterne.example', gross: '240000', employee: '52800', employer: '96000', net: '187200' },
  ])
  const november = await db.query(`SELECT gross FROM payslip.due('2026-11') WHERE member = 'chloe@lanterne.example'`)
  assert.equal(november.rows[0].gross, '250000')
})

test('a run is prepared with exactly what its members are due', async () => {
  await db.query(`INSERT INTO payslip.run (month, generated) VALUES ('2026-10', '2026-11-02')`)
  assert.equal(await rule('generates', { month: '2026-10' }), '2026-10\'s payslips are not what its salaried members are due')
  await db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     SELECT '2026-10', member, cella.amount(gross), cella.amount(employee), cella.amount(employer), cella.amount(net) FROM payslip.due('2026-10')`,
  )
  assert.equal(await rule('generates', { month: '2026-10' }), null)
  assert.equal(await rule('generates', { month: '2026-09' }), '2026-09\'s run was not prepared by this write')
})

test('a payslip\'s net is its gross less the employee\'s contributions', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`INSERT INTO payslip.payslip (month, member, gross, employee, employer, net) VALUES ('2026-10', 'x', cella.amount(100), cella.amount(10), cella.amount(40), cella.amount(80))`),
    /payslip_check/,
  )
  await db.query('ROLLBACK')
})

test('a run is paid only once approved; once approved its payslips never change, and once paid, nothing does', async () => {
  await refused(() => db.query(`UPDATE payslip.run SET paid = '2026-11-02' WHERE month = '2026-10'`), /the 2026-10 run is not approved|run_check/)
  await db.query(`UPDATE payslip.run SET approved = '2026-11-02', approver = 'camille@lanterne.example' WHERE month = '2026-10'`)
  await refused(() => db.query(`UPDATE payslip.payslip SET minutes = 1 WHERE month = '2026-10'`), /the 2026-10 run is approved: its payslips never change/)
  await refused(
    () => db.query(`UPDATE payslip.run SET approved = '2026-11-03', approver = 'julien@lanterne.example' WHERE month = '2026-10'`),
    /the 2026-10 run was approved on 2026-11-02/,
  )
  await db.query(`UPDATE payslip.run SET paid = '2026-11-02' WHERE month = '2026-10'`)
  await refused(() => db.query(`UPDATE payslip.run SET paid = '2026-11-03' WHERE month = '2026-10'`), /the 2026-10 run was paid on 2026-11-02/)
  assert.equal(await rule('pays', { month: '2026-10' }), null)
})

test('the highest salary is at most the ratio times the lowest', async () => {
  await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ('amina@lanterne.example', '2026-12-01', cella.amount(150000))`)
  await db.query(`INSERT INTO payslip.run (month, generated) VALUES ('2026-12', '2026-11-02')`)
  await db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     SELECT '2026-12', member, cella.amount(gross), cella.amount(employee), cella.amount(employer), cella.amount(net) FROM payslip.due('2026-12')`,
  )
  const spread = async (month: string) => (await db.query<{ r: string | null }>('SELECT payslip.spread($1) AS r', [month])).rows[0].r
  assert.equal(await spread('2026-12'), '2026-12\'s highest salary, 300000 cents, is more than 1.60 times its lowest, 150000 cents')
  assert.equal(await spread('2026-10'), null)
  // Outside a write there is no actor, so no approval is this write's.
  assert.equal(await rule('approves', { month: '2026-10' }), '2026-10\'s run was not approved by this write')
})
