// The work share divided by time worked, on a database holding the app's
// core, the patronage and timesheet feats and this graft: the portion that
// divides by time divides by the minutes of each member's approved months
// in the year alone, to the cent; approving makes the parts in that
// write, which the rules take. Run by `cella test slice patronage-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const rows = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r

// Minutes logged on a day, and the month approved or left open.
async function worked(member: string, day: string, minutes: number) {
  await db.query(`INSERT INTO timesheet.entry (member, day, minutes) VALUES ($1, $2, $3)`, [member, day, minutes])
}
const approve = (member: string, month: string) =>
  db.query(`UPDATE timesheet.period SET submitted = '2026-01-05', approved = '2026-01-06', approver = 'lead@x' WHERE member = $1 AND month = $2`, [member, month])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`INSERT INTO patronage.terms (id, "from", hours, capital, adopted) VALUES ('t-2020', 2020, 100, 0, '2020-01-10')`)
  await worked('ana@x', '2025-03-03', 360)
  await worked('ana@x', '2025-03-04', 240)
  await worked('ben@x', '2025-03-03', 300)
  await worked('ben@x', '2025-04-01', 300)
  await worked('ana@x', '2024-12-30', 240)
  await approve('ana@x', '2025-03')
  await approve('ben@x', '2025-03')
  await approve('ana@x', '2024-12')
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ('2025', 2025, cella.amount(1800000), 'hours')`)
  await db.query(`INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ('2025', 'work', 50, cella.amount(900000)), ('2025', 'legal', 50, cella.amount(900000))`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core, the patronage and timesheet feats and this graft are migrated', async () => {
  assert.deepEqual(await rows(`SELECT nspname FROM pg_namespace WHERE nspname IN ('payslip', 'membership', 'patronage_payslip')`), [])
})

test('the portion divides by the minutes of approved months in the year alone', async () => {
  assert.deepEqual(await rows(`SELECT member, minutes FROM patronage_timesheet.basis(2025) ORDER BY member`), [
    { member: 'ana@x', minutes: '600' },
    { member: 'ben@x', minutes: '300' },
  ])
  assert.deepEqual(await rows(`SELECT worker, minutes, cents FROM patronage_timesheet.division('2025') ORDER BY worker`), [
    { worker: 'ana@x', minutes: '600', cents: '600000' },
    { worker: 'ben@x', minutes: '300', cents: '300000' },
  ])
})

test('approving makes the parts in that write, which both rules take', async () => {
  await db.query(`UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = '2025'`)
  assert.deepEqual(await rows(`SELECT worker, basis, quantity, cella.cents(amount) AS cents FROM patronage.part ORDER BY worker`), [
    { worker: 'ana@x', basis: 'hours', quantity: '600', cents: '600000' },
    { worker: 'ben@x', basis: 'hours', quantity: '300', cents: '300000' },
  ])
  assert.equal(await rule('patronage_timesheet.divides', { distribution: '2025' }), null)
  assert.equal(await rule('patronage.divides', { distribution: '2025' }), null)
})

test('parts no longer what the approved time gives are refused', async () => {
  await approve('ben@x', '2025-04')
  assert.equal(await rule('patronage_timesheet.divides', { distribution: '2025' }), '2025\'s parts by time worked are not its portion divided by the minutes approved in 2025')
})
