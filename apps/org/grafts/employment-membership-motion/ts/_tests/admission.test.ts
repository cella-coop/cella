// A candidate's admission, on a database holding the app's core, the
// motion, member and worker feats, the two grafts below and this one:
// each candidate with the latest motion moving to admit them, an open
// one first; and a proposal due once the probation is over, the candidate
// invited and no motion open, not before and not while one is. Run by
// `cella test slice employment-membership-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const bastien = 'bastien@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const admissions = () =>
  all<{ address: string; stage: string; motion: string | null; due: boolean }>(
    'SELECT address, stage, motion, due FROM employment_membership_motion.admission ORDER BY address',
  )

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad'),
       ($2, 'Bastien Roux') ON CONFLICT DO NOTHING) INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired) VALUES
       ($1, 'Inès Haddad', 'junior developer', 'permanent', '2025-09-01', NULL, 2100, '2025-09-01'),
       ($2, 'Bastien Roux', 'apprentice developer', 'apprenticeship', '2026-09-01', '2028-08-31', 2100, '2026-09-01')`,
    [ines, bastien],
  )
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, shares, invited) VALUES ($1, 'invited', 0, '2026-09-30')`, [ines])
  await db.query(
    `INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES
       ($1, '2025-09-01', '2026-08-31', 20, '2025-09-01'), ($2, '2026-09-01', '2027-02-28', 20, '2026-09-01')`,
    [ines, bastien],
  )
})

after(async () => {
  await db.end()
})

test('invited, her probation over and no motion moving to admit her, Inès is due a proposal; Bastien, on probation, is not', async () => {
  assert.deepEqual(await admissions(), [
    { address: bastien, stage: 'candidate', motion: null, due: false },
    { address: ines, stage: 'invited', motion: null, due: true },
  ])
})

test('an open motion to admit her holds the proposal back; once it closes without admitting her, one is due again', async () => {
  await db.query(`INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline) VALUES ('m-1', 'ag', 'camille@lanterne.example', 'Admit Inès', 'consent', 'consent', '2026-10-14', '2026-10-31')`)
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-1', 1, 'admit', '{"member": "ines@lanterne.example", "shares": 20}')`)
  assert.deepEqual((await admissions()).find((a) => a.address === ines), { address: ines, stage: 'invited', motion: 'm-1', due: false })
  await db.query(`UPDATE motion.motion SET closed = '2026-10-31', cutoff = 1 WHERE id = 'm-1'`)
  assert.deepEqual((await admissions()).find((a) => a.address === ines), { address: ines, stage: 'invited', motion: 'm-1', due: true })
})
