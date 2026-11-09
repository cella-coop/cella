// The workers alone, on a database holding only the app's core, the person
// feat and this one: whether a worker is employed on a day and in a month,
// from their first day to their last, both included; a contract that ends before it
// starts, or a fixed-term one with no end, refused by the table; and
// `employment.hires`, that the write recorded the hire it names on its day.
// Run by `cella test slice employment`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const paul = 'paul@lanterne.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const hires = async (payload: object) => (await one<{ r: string | null }>('SELECT employment.hires($1) AS r', [payload])).r

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

test('only the app\'s core, core person and this one are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'payslip', 'timesheet')`)
  assert.deepEqual(rows, [])
})

test('a worker is employed from their first day to their last, both included', async () => {
  const on = async (who: string, day: string) => (await one<{ e: boolean }>('SELECT employment.employed($1, $2) AS e', [who, day])).e
  assert.equal(await on(ines, '2025-08-31'), false)
  assert.equal(await on(ines, '2025-09-01'), true)
  assert.equal(await on(ines, '2026-10-24'), true)
  assert.equal(await on(paul, '2025-11-30'), true)
  assert.equal(await on(paul, '2025-12-01'), false)
  assert.equal(await on('nobody@lanterne.example', '2026-10-24'), false)
  const within = async (who: string, month: string) => (await one<{ e: boolean }>('SELECT employment.employed_in($1, $2) AS e', [who, month])).e
  assert.equal(await within(ines, '2025-08'), false)
  assert.equal(await within(ines, '2025-09'), true)
  assert.equal(await within(paul, '2025-11'), true)
  assert.equal(await within(paul, '2025-12'), false)
})

test('a contract runs forward, and a fixed-term one names its last day', async () => {
  await db.query('BEGIN')
  await db.query('SAVEPOINT s')
  await assert.rejects(
    db.query(`INSERT INTO employment.worker (address, job, contract, start, until, minutes, hired) VALUES ('a@x', 'job', 'permanent', '2026-10-01', '2026-09-30', 2100, '2026-10-01')`),
    /worker_check/,
  )
  await db.query('ROLLBACK TO s')
  await assert.rejects(
    db.query(`INSERT INTO employment.worker (address, job, contract, start, minutes, hired) VALUES ('a@x', 'job', 'fixed-term', '2026-10-01', 2100, '2026-10-01')`),
    /worker_check/,
  )
  await db.query('ROLLBACK')
})

test('a hire is the write\'s on its day, with the contract it names', async () => {
  await db.query('BEGIN')
  try {
    await db.query(
      `WITH person AS (INSERT INTO person.person (address, name) VALUES ('bastien@lanterne.example', 'Bastien Roux') ON CONFLICT DO NOTHING)
       INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired)
       VALUES ('bastien@lanterne.example', 'Bastien Roux', 'apprentice developer', 'apprenticeship', '2026-11-02', '2028-08-31', 2100, cella.verdict_date())`,
    )
    const payload = { worker: 'bastien@lanterne.example', contract: 'apprenticeship', start: '2026-11-02', until: '2028-08-31', minutes: 2100 }
    assert.equal(await hires(payload), null)
    assert.match((await hires({ ...payload, minutes: 1800 })) ?? '', /contract is not what the write names/)
    assert.match((await hires({ ...payload, worker: ines })) ?? '', /ines@lanterne.example was not hired by this write/)
    assert.match((await hires({ ...payload, worker: 'nobody@lanterne.example' })) ?? '', /nobody@lanterne.example was not hired by this write/)
  } finally {
    await db.query('ROLLBACK')
  }
})
