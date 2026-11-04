// The payslips alone, on a database holding only the app's core and this
// feat: what each salaried member is due, from the salary in force and
// the terms' rates, and nothing once it has ended; a run prepared with exactly that; a run approved and
// paid once, its payslips fixed from its approval; and the pay ratio.
// Run by `cella test slice payslip`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

// Who reads, on the app's role as the server connects: the rows a query
// returns read as `actor`, or as no one. A stub authority stands in for
// the membership feat's, which says who holds a power.
const app = new pg.Client({ user: 'cella_app' })
const reading = async (actor: string | null, sql: string, values: unknown[] = []) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor ?? ''])
  return (await app.query(sql, values)).rows
}

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

const guard = async (fn: string, payload: object) =>
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
  await app.end()
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'timesheet', 'transaction')`)
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

test('a salary is due until its last day, and nothing in a month after it ended', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO payslip.salary (member, "from", until, gross) VALUES ('lea@lanterne.example', '2025-01-01', '2026-09-30', cella.amount(200000))`)
    const due = async (month: string) =>
      (await db.query(`SELECT gross FROM payslip.due($1) WHERE member = 'lea@lanterne.example'`, [month])).rows
    assert.deepEqual(await due('2026-09'), [{ gross: '200000' }])
    assert.deepEqual(await due('2026-10'), [])
  } finally {
    await db.query('ROLLBACK')
  }
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`INSERT INTO payslip.salary (member, "from", until, gross) VALUES ('lea@lanterne.example', '2025-01-01', '2024-12-31', cella.amount(200000))`),
    /salary_check/,
  )
  await db.query('ROLLBACK')
})

test('a run is prepared with exactly what its members are due', async () => {
  await db.query(`INSERT INTO payslip.run (month, generated) VALUES ('2026-10', '2026-11-02')`)
  assert.equal(await guard('generates', { month: '2026-10' }), '2026-10\'s payslips are not what its salaried members are due')
  await db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     SELECT '2026-10', member, cella.amount(gross), cella.amount(employee), cella.amount(employer), cella.amount(net) FROM payslip.due('2026-10')`,
  )
  assert.equal(await guard('generates', { month: '2026-10' }), null)
  assert.equal(await guard('generates', { month: '2026-09' }), '2026-09\'s run was not prepared by this write')
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
  assert.equal(await guard('pays', { month: '2026-10' }), null)
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
  assert.equal(await guard('approves', { month: '2026-10' }), '2026-10\'s run was not approved by this write')
})

test('as the app role, a member reads their own salary, payslips and runs; a payroll power reads every one; no one signed in, none', async () => {
  await app.connect()
  await db.query(`CREATE SCHEMA mandate`)
  await db.query(
    `CREATE FUNCTION mandate.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = 'julien@lanterne.example' AND power = 'approve-payroll'`,
  )
  await db.query(`GRANT USAGE ON SCHEMA mandate TO cella_app`)
  await db.query(
    `CREATE FUNCTION mandate.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN mandate.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(`INSERT INTO cella.authority (fn, covered, owner) VALUES ('mandate.may(text, text, bigint, text, date)', 'mandate.covered(text, text, date)', 'test')`)
  const chloe = 'chloe@lanterne.example'
  const count = async (sql: string) => Number((await db.query(sql)).rows[0].n)
  for (const table of ['salary', 'payslip']) {
    const mine = await reading(chloe, `SELECT DISTINCT member FROM payslip.${table}`)
    assert.deepEqual(mine, [{ member: chloe }], `Chloé reads her own ${table} alone`)
    assert.equal((await reading('julien@lanterne.example', `SELECT member FROM payslip.${table}`)).length, await count(`SELECT count(*) AS n FROM payslip.${table}`))
    assert.deepEqual(await reading(null, `SELECT member FROM payslip.${table}`), [])
  }
  const paid = await count(`SELECT count(DISTINCT month) AS n FROM payslip.payslip WHERE member = '${chloe}'`)
  assert.equal((await reading(chloe, 'SELECT month FROM payslip.run')).length, paid, 'she reads the runs she is paid in')
  assert.equal((await reading('julien@lanterne.example', 'SELECT month FROM payslip.run')).length, await count('SELECT count(*) AS n FROM payslip.run'))
  assert.equal((await reading('amina@lanterne.example', 'SELECT month FROM payslip.run')).length, 1, 'Amina is paid in December alone')
})

test('a write\'s transaction reads every row, whoever writes, and the guards read every row', async () => {
  await app.query('BEGIN')
  try {
    await app.query(`SELECT set_config('cella.actor', 'chloe@lanterne.example', true), set_config('cella.writing', 'on', true)`)
    const all = Number((await db.query('SELECT count(*) AS n FROM payslip.payslip')).rows[0].n)
    assert.equal((await app.query('SELECT member FROM payslip.payslip')).rows.length, all)
  } finally {
    await app.query('ROLLBACK')
  }
  const after = await app.query<{ w: string | null }>(`SELECT nullif(current_setting('cella.writing', true), '') AS w`)
  assert.equal(after.rows[0].w, null, 'the write ends with its transaction')
  await db.query('BEGIN')
  try {
    await db.query('SET LOCAL ROLE cella_guards')
    assert.ok((await db.query('SELECT DISTINCT member FROM payslip.salary')).rows.length > 1)
  } finally {
    await db.query('ROLLBACK')
  }
})
