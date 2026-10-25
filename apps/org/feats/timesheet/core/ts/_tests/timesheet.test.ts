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

// Who reads, on the app's role as the server connects: the rows a query
// returns read as `actor`, or as no one. A stub authority stands in for
// circle-membership's, which says who holds a power.
const app = new pg.Client({ user: 'cella_app' })
const reading = async (actor: string | null, sql: string, values: unknown[] = []) => {
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [actor ?? ''])
  return (await app.query(sql, values)).rows
}

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
  await app.end()
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'membership_timesheet', 'project_timesheet')`)
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

test('as the app role, a member reads their own entries, months and sheets; whoever approves time, everyone\'s; no one signed in, none', async () => {
  await app.connect()
  await db.query(`CREATE SCHEMA mandate`)
  await db.query(
    `CREATE FUNCTION mandate.may(actor text, power text, cents bigint, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = 'hugo@lanterne.example' AND power = 'approve-time'`,
  )
  await db.query(`GRANT USAGE ON SCHEMA mandate TO cella_app`)
  await db.query(`INSERT INTO cella.authority (fn, owner) VALUES ('mandate.may(text, text, bigint, date)', 'test')`)
  const camille = 'camille@lanterne.example'
  await db.query(`INSERT INTO timesheet.entry (member, day, minutes, billable) VALUES ($1, '2026-10-05', 420, true)`, [camille])
  const members = async (actor: string | null, sql: string) => [...new Set((await reading(actor, sql)).map((r) => r.member))]
  for (const sql of ['SELECT member FROM timesheet.entry', 'SELECT member FROM timesheet.period', 'SELECT member FROM timesheet.sheet']) {
    assert.deepEqual(await members(lea, sql), [lea], sql)
    assert.deepEqual(await members(camille, sql), [camille], sql)
    assert.deepEqual((await members('hugo@lanterne.example', sql)).sort(), [camille, lea], sql)
    assert.deepEqual(await members(null, sql), [], sql)
  }
})
