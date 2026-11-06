// A run from approved time, on a database holding the app's core, the
// payslip and timesheet feats and this graft: `payslip_timesheet.timed`
// holds a run back while a member's month is open or only submitted in
// any circle they worked for, and takes it once every month is approved
// and each payslip holds the minutes of all of them. Run by `cella test
// slice payslip-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const lea = 'lea@lanterne.example'
const thomas = 'thomas@lanterne.example'

const timed = async () => (await db.query<{ r: string | null }>('SELECT payslip_timesheet.timed($1) AS r', [{ month: '2026-10' }])).rows[0].r
let root = ''

before(async () => {
  await db.connect()
  root = (await db.query<{ id: string }>('SELECT circle.assembly() AS id')).rows[0].id
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('web', 'Web')`)
  await db.query(`INSERT INTO payslip.terms (employee, employer, ratio) VALUES (22, 40, 1.6)`)
  await db.query(
    `INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, '2025-01-01', cella.amount(250000)), ($2, '2025-01-01', cella.amount(250000))`,
    [lea, thomas],
  )
  // Léa works for the root circle and for Web in October: a month in each.
  await db.query(
    `INSERT INTO timesheet.entry (member, day, minutes) VALUES ($1, '2026-10-01', 420), ($1, '2026-10-02', 405), ($2, '2026-10-01', 420)`,
    [lea, thomas],
  )
  await db.query(`INSERT INTO timesheet.entry (member, day, minutes, circle) VALUES ($1, '2026-10-05', 60, 'web')`, [lea])
  await db.query(`INSERT INTO payslip.run (month, generated) VALUES ('2026-10', '2026-11-02')`)
  await db.query(
    `INSERT INTO payslip.payslip (month, member, gross, employee, employer, net)
     SELECT '2026-10', member, cella.amount(gross), cella.amount(employee), cella.amount(employer), cella.amount(net) FROM payslip.due('2026-10')`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the feats it joins and this graft are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'transaction', 'membership_timesheet')`)
  assert.deepEqual(rows, [])
})

test('a run waits for every member\'s month to be approved, in every circle they worked for', async () => {
  const first = [root, 'web'].sort()[0]
  assert.equal(await timed(), `${lea}'s 2026-10 in ${first} is open, not approved: the run waits for it`)
  await db.query(`UPDATE timesheet.period SET submitted = '2026-10-31' WHERE month = '2026-10'`)
  await db.query(`UPDATE timesheet.period SET approved = '2026-11-02', approver = $2 WHERE member = $1 AND circle = $3`, [lea, thomas, root])
  assert.equal(await timed(), `${lea}'s 2026-10 in web is submitted, not approved: the run waits for it`)
  await db.query(`UPDATE timesheet.period SET approved = '2026-11-02', approver = $2 WHERE member = $1 AND circle = 'web'`, [lea, thomas])
  assert.equal(await timed(), `${thomas}'s 2026-10 in ${root} is submitted, not approved: the run waits for it`)
  await db.query(`UPDATE timesheet.period SET approved = '2026-11-02', approver = $2 WHERE member = $1`, [thomas, lea])
})

test('once approved, each payslip holds its member\'s minutes, summed over their circles', async () => {
  assert.equal(await timed(), `${lea}'s payslip for 2026-10 does not hold the minutes of their approved months`)
  await db.query(`UPDATE payslip.payslip SET minutes = payslip_timesheet.minutes(member, month) WHERE month = '2026-10'`)
  assert.equal(await timed(), null)
  const { rows } = await db.query(`SELECT member, minutes FROM payslip.payslip ORDER BY member`)
  assert.deepEqual(rows, [{ member: lea, minutes: 885 }, { member: thomas, minutes: 420 }])
})
