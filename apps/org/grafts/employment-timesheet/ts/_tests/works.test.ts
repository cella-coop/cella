// A worker's time, on a database holding the app's core, the timesheet and
// worker feats and this graft: a worker's entry falls on a day of their
// employment, while an entry of no worker's is the members' to judge; and
// the graft has no action of its own, a worker logging by the timesheet
// feat's. Whose the actor is, the e2e scenario `people` holds. Run by
// `cella test slice employment-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const whose = async (payload: object) => (await all<{ r: string | null }>('SELECT employment_timesheet.whose($1) AS r', [payload]))[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad'),
       ($2, 'Paul Garnier') ON CONFLICT DO NOTHING) INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired) VALUES
       ($1, 'Inès Haddad', 'junior developer', 'permanent', '2025-09-01', NULL, 2100, '2025-09-01'),
       ($2, 'Paul Garnier', 'art director', 'permanent', '2021-03-01', '2025-11-30', 2100, '2021-03-01')`,
    [ines, paul],
  )
})

after(async () => {
  await db.end()
})

test('a worker logs time on days of their employment, and none after they leave', async () => {
  assert.equal(await whose({ member: ines, day: '2026-10-23' }), null)
  assert.equal(await whose({ member: paul, day: '2025-11-28' }), null)
  assert.match((await whose({ member: paul, day: '2025-12-01' })) ?? '', /paul@lanterne.example is not employed on 2025-12-01/)
  // No worker's, a member's: not this graft's to judge.
  assert.equal(await whose({ member: 'nadia@lanterne.example', day: '2026-10-23' }), null)
  await db.query(`INSERT INTO timesheet.entry (member, day, minutes, billable, note) VALUES ($1, '2026-10-23', 420, false, 'Reviews')`, [ines])
  await db.query(`INSERT INTO timesheet.entry (member, day, minutes, billable, note) VALUES ($1, '2025-11-28', 420, true, 'Packaging')`, [paul])
  await db.query(`INSERT INTO timesheet.entry (member, day, minutes, billable, note) VALUES ('nadia@lanterne.example', '2026-10-23', 60, false, '')`)
  const { rows } = await db.query(`SELECT name, month, hours::float8 AS hours FROM employment_timesheet.sheet ORDER BY name`)
  assert.deepEqual(rows, [
    { name: 'Inès Haddad', month: '2026-10', hours: 7 },
    { name: 'Paul Garnier', month: '2025-11', hours: 7 },
  ])
})

test('the graft has no action of its own: a worker logs, corrects and submits by the timesheet feat\'s writes', async () => {
  assert.deepEqual(await all(`SELECT op FROM cella.guard WHERE op LIKE 'employment-timesheet:%' UNION ALL SELECT op FROM cella.power WHERE op LIKE 'employment-timesheet:%'`), [])
})

test('a log meets the worker\'s days by a guard, and no trigger of this graft\'s is on the entries', async () => {
  const guards = await all<{ op: string }>(`SELECT op FROM cella.guard WHERE fn = 'employment_timesheet.whose(jsonb)'::regprocedure`)
  assert.deepEqual(guards, [{ op: 'timesheet:entry:log' }])
  assert.deepEqual(await all(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'timesheet.entry'::regclass AND tgname = 'worker'`), [])
})
