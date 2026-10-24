// The timesheets alone, on a database holding only the app's core and
// this feat: an entry makes its member's month, an approved month takes no
// entry and stays approved, only a submitted month is approved, and the
// rules refuse what is not the actor's own. Run by `cella test slice
// timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const lea = 'lea@lanterne.example'

const log = (day: string, hours: number, billable = true) =>
  db.query('INSERT INTO timesheet.entry (member, day, minutes, billable) VALUES ($1, $2, $3, $4)', [lea, day, Math.round(hours * 60), billable])

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
  (await db.query<{ r: string | null }>(`SELECT timesheet.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('member', 'member_timesheet', 'project_timesheet')`)
  assert.deepEqual(rows, [])
})

test('an entry makes its member\'s month, open, and the sheet adds its hours up', async () => {
  await log('2026-10-12', 3)
  await log('2026-10-12', 4, false)
  await log('2026-10-13', 7)
  const { rows } = await db.query(
    `SELECT month, hours::float8 AS hours, billable::float8 AS billable, entries, state FROM timesheet.sheet WHERE member = $1`,
    [lea],
  )
  assert.deepEqual(rows, [{ month: '2026-10', hours: 14, billable: 10, entries: 3, state: 'open' }])
})

test('an entry is more than no time and at most a day', async () => {
  for (const hours of [0, 24.5]) {
    await db.query('BEGIN')
    await assert.rejects(log('2026-10-14', hours), /entry_minutes_check/)
    await db.query('ROLLBACK')
  }
})

test('only a submitted month is approved', async () => {
  await refused(
    () => db.query(`UPDATE timesheet.period SET approved = '2026-11-02', approver = 'yusuf@lanterne.example' WHERE member = $1`, [lea]),
    /lea@lanterne.example's 2026-10 is not submitted/,
  )
})

test('an approved month takes no new entry, and stays approved', async () => {
  await db.query(`UPDATE timesheet.period SET submitted = '2026-10-30' WHERE member = $1 AND month = '2026-10'`, [lea])
  await db.query(
    `UPDATE timesheet.period SET approved = '2026-11-02', approver = 'yusuf@lanterne.example' WHERE member = $1 AND month = '2026-10'`,
    [lea],
  )
  await refused(() => log('2026-10-30', 2), /lea@lanterne.example's 2026-10 was approved on 2026-11-02: it takes no new entries/)
  await refused(
    () => db.query(`UPDATE timesheet.period SET submitted = '2026-11-03' WHERE member = $1 AND month = '2026-10'`, [lea]),
    /was approved on 2026-11-02/,
  )
  await log('2026-11-02', 7)
})

test('outside a write the rules judge no one\'s time their own', async () => {
  assert.match((await rule('logs', { member: lea, day: '2026-10-12' })) ?? '', /may not log time for lea@lanterne.example/)
  assert.match((await rule('submits', { member: lea, month: '2026-11' })) ?? '', /may not submit lea@lanterne.example's time/)
  assert.match((await rule('approves', { member: lea, month: '2026-10' })) ?? '', /was not approved by this write/)
  assert.equal(await rule('approves', { member: lea, month: '2025-01' }), 'no timesheet lea@lanterne.example 2025-01')
})
