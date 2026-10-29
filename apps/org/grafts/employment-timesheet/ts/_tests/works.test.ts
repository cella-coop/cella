// A worker's time, on a database holding the app's core, the timesheet and
// worker feats and this graft: a worker's entry falls on a day of their
// employment, while an entry of no worker's is the members' to judge; and
// the rules on logging, correcting and submitting by one's employment,
// this graft's and the timesheet feat's own. Whose the actor is, the e2e
// scenario `people` holds. Run by `cella test slice employment-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const works = async (payload: object) => (await all<{ r: string | null }>('SELECT employment_timesheet.works($1) AS r', [payload]))[0].r
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

test('outside a write the rule judges no one a worker: who logs is the write\'s actor', async () => {
  assert.match((await works({ member: ines, day: '2026-10-23' })) ?? '', /no one is no worker: a worker logs their time by their employment/)
})

test('the timesheet feat\'s own rules run on these ops too: the time is the actor\'s own', async () => {
  const rules = await all<{ op: string; fn: string }>(`SELECT op, fn::text AS fn FROM cella.rule WHERE op LIKE 'employment-timesheet:%' ORDER BY op, fn::text`)
  assert.deepEqual(rules, [
    { op: 'employment-timesheet:entry:correct', fn: 'employment_timesheet.works(jsonb)' },
    { op: 'employment-timesheet:entry:correct', fn: 'timesheet.corrects(jsonb)' },
    { op: 'employment-timesheet:entry:log', fn: 'employment_timesheet.works(jsonb)' },
    { op: 'employment-timesheet:entry:log', fn: 'timesheet.logs(jsonb)' },
    { op: 'employment-timesheet:period:submit', fn: 'employment_timesheet.works(jsonb)' },
    { op: 'employment-timesheet:period:submit', fn: 'timesheet.submits(jsonb)' },
  ])
})

test('a log by the log-time mandate meets the worker\'s days by a rule, and no trigger of this graft\'s is on the entries', async () => {
  const rules = await all<{ op: string }>(`SELECT op FROM cella.rule WHERE fn = 'employment_timesheet.whose(jsonb)'::regprocedure`)
  assert.deepEqual(rules, [{ op: 'timesheet:entry:log' }])
  assert.deepEqual(await all(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'timesheet.entry'::regclass AND tgname = 'worker'`), [])
})
