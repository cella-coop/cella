// A worker's way to membership, on a database holding the app's core, the
// member and worker feats and this graft: each person's stage, from an
// employee to a candidate, invited, a member and gone; and
// `employment_membership.opens`, that a candidacy is a worker's who is not yet a
// member, its probation within their employment, opened once, on the
// write's day. Run by `cella test slice employment-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const thomas = 'thomas@lanterne.example'
const bastien = 'bastien@lanterne.example'
const nadia = 'nadia@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const opens = async (payload: object) => (await all<{ r: string | null }>('SELECT employment_membership.opens($1) AS r', [payload]))[0].r

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

test('a candidacy is a worker\'s who is not yet a member, within their employment, opened by the write on its day', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, '2026-09-01', '2027-02-28', 20, '2026-10-24')`, [bastien])
    const payload = { worker: bastien, from: '2026-09-01', to: '2027-02-28', shares: 20 }
    assert.equal(await opens(payload), null)
    assert.equal((await all<{ stage: string }>('SELECT stage FROM employment_membership.path WHERE address = $1', [bastien]))[0].stage, 'candidate')
    assert.match((await opens({ ...payload, shares: 30 })) ?? '', /candidacy is not what the write names/)
    assert.match((await opens({ ...payload, worker: ines })) ?? '', /ines@lanterne.example's candidacy was not opened by this write/)
    assert.match((await opens({ ...payload, worker: thomas })) ?? '', /thomas@lanterne.example is active as a member: a candidate is not yet one/)
    assert.match((await opens({ ...payload, worker: nadia })) ?? '', /nadia@lanterne.example is no worker: a candidate is one/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a probation starts no earlier than the hire, and ends no later than the contract', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, '2026-08-01', '2027-09-30', 20, '2026-10-24')`, [bastien])
    const early = await opens({ worker: bastien, from: '2026-08-01', to: '2027-09-30', shares: 20 })
    assert.match(early ?? '', /probation starts on 2026-08-01, before their hire on 2026-09-01/)
  } finally {
    await db.query('ROLLBACK')
  }
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, '2026-09-01', '2027-09-30', 20, '2026-10-24')`, [bastien])
    const late = await opens({ worker: bastien, from: '2026-09-01', to: '2027-09-30', shares: 20 })
    assert.match(late ?? '', /probation ends on 2027-09-30, after their contract does on 2027-08-31/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a worker has one candidacy', async () => {
  await assert.rejects(
    db.query(`INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, '2025-09-01', '2026-02-28', 20, '2026-10-24')`, [ines]),
    /candidacy_pkey/,
  )
})
