// A worker's way to membership, on a database holding the app's core, the
// member and worker feats and this graft: each person's stage, from an
// employee to a candidate, invited, a member and gone; a candidacy, one
// to a worker; and `employment_membership.serves`, that an employee
// applies after a year's employment, while still employed. That the
// candidacy is the worker's own, on their application, reads the actor,
// which only a write has: the people scenario proves it. Run by `cella
// test slice employment-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const thomas = 'thomas@lanterne.example'
const bastien = 'bastien@lanterne.example'
const nadia = 'nadia@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
// `serves` on a day, as the clock reads it.
const serves = async (member: string, day: string) => {
  await db.query(`SELECT set_config('cella.clock', $1, false)`, [day])
  try {
    return (await all<{ r: string | null }>('SELECT employment_membership.serves($1) AS r', [{ member }]))[0].r
  } finally {
    await db.query(`SET cella.clock = '2026-10-24'`)
  }
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad'),
       ($2, 'Thomas Nguyen'),
       ($3, 'Bastien Roux') ON CONFLICT DO NOTHING) INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired) VALUES
       ($1, 'Inès Haddad', 'junior developer', 'permanent', '2025-09-01', NULL, 2100, '2025-09-01'),
       ($2, 'Thomas Nguyen', 'full-stack developer', 'permanent', '2021-10-04', NULL, 2100, '2021-10-04'),
       ($3, 'Bastien Roux', 'apprentice developer', 'apprenticeship', '2026-09-01', '2027-08-31', 2100, '2026-09-01')`,
    [ines, thomas, bastien],
  )
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad'),
       ($2, 'Thomas Nguyen'),
       ($3, 'Nadia Benali') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares, invited) VALUES
       ($1, 'invited', NULL, 0, '2026-09-30'),
       ($2, 'active', '2022-04-04', 20, NULL),
       ($3, 'active', '2024-01-01', 20, NULL)`,
    [ines, thomas, nadia],
  )
  await db.query(`INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, '2025-09-01', '2026-08-31', 20, '2025-09-01')`, [ines])
})

after(async () => {
  await db.end()
})

test('each person\'s stage: an employee, invited after a probation, a member, and a member never employed', async () => {
  const rows = await all<{ address: string; stage: string; pledged: number | null }>(
    'SELECT address, stage, pledged FROM employment_membership.path ORDER BY address',
  )
  assert.deepEqual(rows, [
    { address: bastien, stage: 'employee', pledged: null },
    { address: ines, stage: 'invited', pledged: 20 },
    { address: nadia, stage: 'member', pledged: null },
    { address: thomas, stage: 'member', pledged: null },
  ])
})

test('an employee applies once they have worked a year, while still employed', async () => {
  assert.equal(await serves(ines, '2026-10-24'), null)
  assert.match((await serves(bastien, '2026-10-24')) ?? '', /bastien@lanterne.example was hired on 2026-09-01: an employee applies to join after a year's employment, from 2027-09-01/)
  assert.match((await serves(bastien, '2027-08-31')) ?? '', /after a year's employment, from 2027-09-01/)
  assert.match((await serves(bastien, '2027-09-01')) ?? '', /bastien@lanterne.example's contract ended on 2027-08-31/)
  assert.match((await serves(nadia, '2026-10-24')) ?? '', /nadia@lanterne.example is no worker/)
})
test('a worker has one candidacy', async () => {
  await assert.rejects(
    db.query(`INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, '2025-09-01', '2026-02-28', 20, '2026-10-24')`, [ines]),
    /candidacy_pkey/,
  )
})
