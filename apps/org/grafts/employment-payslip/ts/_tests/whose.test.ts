// Whose pay is, on a database holding the app's core, the payslip and
// worker feats and this graft: the guard on a run refuses a payslip of no
// worker's, and one of a worker not employed in its month, never before
// their hire nor after they leave, member or not; each payslip names its
// worker. Run by `cella test slice employment-payslip`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'

const whose = async (month: string) =>
  (await db.query<{ r: string | null }>('SELECT employment_payslip.whose($1) AS r', [{ month }])).rows[0].r
const within = async (run: () => Promise<void>) => {
  await db.query('BEGIN')
  try {
    await run()
  } finally {
    await db.query('ROLLBACK')
  }
}
const slip = (month: string, member: string) =>
  db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     VALUES ($1, $2, cella.amount(220000), cella.amount(48400), cella.amount(88000), cella.amount(171600))`,
    [month, member],
  )

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-02'`)
  await db.query(`INSERT INTO payslip.terms (employee, employer, ratio) VALUES (22, 40, 1.6)`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad'),
       ($2, 'Paul Garnier') ON CONFLICT DO NOTHING) INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired) VALUES
       ($1, 'Inès Haddad', 'junior developer', 'permanent', '2025-09-01', NULL, 2100, '2025-09-01'),
       ($2, 'Paul Garnier', 'art director', 'permanent', '2021-03-01', '2025-11-30', 2100, '2021-03-01')`,
    [ines, paul],
  )
  await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, '2026-10-01', cella.amount(220000))`, [ines])
  await db.query(`INSERT INTO payslip.run (month, generated) VALUES ('2025-11', '2025-11-24'), ('2025-12', '2025-12-24'), ('2026-10', '2026-11-02')`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the two feats and this graft are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'timesheet')`)
  assert.deepEqual(rows, [])
})

test('a payslip is a worker\'s employed in its month, Inès\'s though she is no member', async () => {
  await slip('2026-10', ines)
  assert.equal(await whose('2026-10'), null)
  const { rows } = await db.query(`SELECT month, member, name, job FROM employment_payslip.slip`)
  assert.deepEqual(rows, [{ month: '2026-10', member: ines, name: 'Inès Haddad', job: 'junior developer' }])
})

test('a run holding a payslip of no worker\'s is refused, as a salary of no worker\'s turns into one', async () => {
  await within(async () => {
    await slip('2026-10', 'nobody@lanterne.example')
    assert.match((await whose('2026-10')) ?? '', /nobody@lanterne.example is no worker: a payslip is one's/)
  })
})

test('a worker is paid for the month they leave, and none after', async () => {
  await within(async () => {
    await slip('2025-11', paul)
    assert.equal(await whose('2025-11'), null)
  })
  await within(async () => {
    await slip('2025-12', paul)
    assert.match((await whose('2025-12')) ?? '', /paul@lanterne.example is employed in no day of 2025-12/)
  })
})

test('a salary ending on its worker\'s last day is due for the month they leave and none after', async () => {
  await within(async () => {
    await db.query(
      `INSERT INTO payslip.salary (member, "from", until, gross) VALUES ($1, '2021-03-01', '2024-12-31', cella.amount(260000)), ($1, '2025-01-01', '2025-11-30', cella.amount(280000))`,
      [paul],
    )
    const due = async (month: string) => (await db.query(`SELECT gross FROM payslip.due($1) WHERE member = $2`, [month, paul])).rows
    assert.deepEqual(await due('2025-11'), [{ gross: '280000' }])
    assert.deepEqual(await due('2025-12'), [])
    await slip('2025-11', paul)
    assert.equal(await whose('2025-11'), null)
  })
})

test('a salary running past its worker\'s last day, or with no end where the contract names one, is refused', async () => {
  await within(async () => {
    await db.query(`INSERT INTO payslip.salary (member, "from", until, gross) VALUES ($1, '2025-01-01', '2025-12-31', cella.amount(280000))`, [paul])
    assert.equal(
      await whose('2026-10'),
      'paul@lanterne.example\'s salary from 2025-01-01 ends on 2025-12-31, after their last day, 2025-11-30: a salary ends when its worker leaves',
    )
  })
  await within(async () => {
    await db.query(`INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, '2025-01-01', cella.amount(280000))`, [paul])
    assert.equal(
      await whose('2026-10'),
      'paul@lanterne.example\'s salary from 2025-01-01 has no end, though their last day is 2025-11-30: a salary ends when its worker leaves',
    )
  })
})

test('the guard runs on the run that makes the payslips, and no trigger of this graft\'s is left on the payslip feat\'s tables', async () => {
  const guards = await db.query(`SELECT op FROM cella.guard WHERE fn = 'employment_payslip.whose(jsonb)'::regprocedure`)
  assert.deepEqual(guards.rows, [{ op: 'payslip:run:generate' }])
  const triggers = await db.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid IN ('payslip.salary'::regclass, 'payslip.payslip'::regclass) AND tgname = 'worker'`,
  )
  assert.deepEqual(triggers.rows, [])
})
