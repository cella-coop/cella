// Whose pay is, on a database holding the app's core, the payslip and
// worker feats and this graft: a salary is a worker's, member or not, and
// a payslip one employed in its month, never before their hire nor after
// they leave; each payslip names its worker. Run by `cella test slice
// payslip-worker`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'

const refused = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql, values), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-02'`)
  await db.query(`INSERT INTO payslip.terms (employee, employer, ratio) VALUES (22, 40, 1.6)`)
  await db.query(
    `INSERT INTO worker.worker (address, name, job, contract, start, until, minutes, hired) VALUES
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
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('member', 'member_payslip', 'timesheet')`)
  assert.deepEqual(rows, [])
})

test('a salary is a worker\'s, member or not', async () => {
  await refused(`INSERT INTO payslip.salary (member, "from", gross) VALUES ('nobody@lanterne.example', '2026-10-01', cella.amount(200000))`, [], /nobody@lanterne.example is no worker: a salary is one's/)
})

test('a payslip is a worker\'s employed in its month, Inès\'s though she is no member', async () => {
  await db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     VALUES ('2026-10', $1, cella.amount(220000), cella.amount(48400), cella.amount(88000), cella.amount(171600))`,
    [ines],
  )
  const { rows } = await db.query(`SELECT month, member, name, job FROM payslip_worker.slip`)
  assert.deepEqual(rows, [{ month: '2026-10', member: ines, name: 'Inès Haddad', job: 'junior developer' }])
})

test('a worker is paid for the month they leave, and none after', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO payslip.payslip (month, member, gross, employee, employer, net) VALUES ('2025-11', $1, cella.amount(250000), cella.amount(55000), cella.amount(100000), cella.amount(195000))`, [paul])
  } finally {
    await db.query('ROLLBACK')
  }
  await refused(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net) VALUES ('2025-12', $1, cella.amount(250000), cella.amount(55000), cella.amount(100000), cella.amount(195000))`,
    [paul],
    /paul@lanterne.example is employed in no day of 2025-12/,
  )
})
