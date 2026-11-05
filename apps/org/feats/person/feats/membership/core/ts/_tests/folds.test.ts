// The membership feat's folds, on a database holding the app's core, the
// person feat and this one (`sql/017-folds.sql`): each entry as the log
// keeps it, applied below the notary by the SQL its handler runs, with
// the entry's day. Run by `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const key = 'cc'.repeat(32)
const link = 'dd'.repeat(32)
const fold = async (fn: string, n: number, op: string, payload: unknown, date: string) =>
  db.query(`SELECT membership.${fn}($1)`, [{ n, op, actor: ines, date, cause: null, payload }])
const member = async () =>
  (
    await db.query(
      `SELECT status, to_char(invited, 'YYYY-MM-DD') AS invited, to_char(since, 'YYYY-MM-DD') AS since, shares,
              to_char(suspended, 'YYYY-MM-DD') AS suspended, to_char(exited, 'YYYY-MM-DD') AS exited, exit
       FROM membership.member WHERE address = $1`,
      [ines],
    )
  ).rows[0]

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Inès') ON CONFLICT DO NOTHING`, [ines])
})

after(async () => {
  await db.end()
})

test('an invitation, its link, its acceptance and an admission fold on their entries\' days', async () => {
  await fold('fold_invite', 2, 'membership:member:invite', { member: ines, invited: '2026-10-01', link }, '2026-10-01')
  await fold('fold_accept', 3, 'membership:member:accept', { member: ines, link, key, accepted: '2026-10-02', label: { $commit: 'e'.repeat(64) } }, '2026-10-02')
  assert.deepEqual(
    (await db.query(`SELECT label, to_char(accepted, 'YYYY-MM-DD') AS accepted FROM membership.invitation WHERE member = $1`, [ines])).rows[0],
    { label: 'redacted', accepted: '2026-10-02' },
  )
  assert.equal((await db.query('SELECT count(*)::int AS n FROM membership.link WHERE member = $1', [ines])).rows[0].n, 1)
  await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, 'phone', '2026-10-02')`, [key, ines])
  await fold('fold_admit', 4, 'membership:member:admit', { member: ines, shares: 2, motion: 'm-2026-012' }, '2026-10-31')
  assert.deepEqual(await member(), { status: 'active', invited: '2026-10-01', since: '2026-10-31', shares: 2, suspended: null, exited: null, exit: null })
})

test('a suspension, then an exclusion, fold as their handlers set them, and a second exclusion changes nothing', async () => {
  await fold('fold_ending', 5, 'membership:member:suspend', { member: ines, motion: 'm-2026-013' }, '2026-11-02')
  assert.equal((await member()).status, 'suspended')
  await fold('fold_ending', 6, 'membership:member:exclude', { member: ines, motion: 'm-2026-014' }, '2026-11-03')
  await fold('fold_ending', 7, 'membership:member:exclude', { member: ines, motion: 'm-2026-015' }, '2026-11-04')
  assert.deepEqual(await member(), { status: 'exited', invited: '2026-10-01', since: '2026-10-31', shares: 2, suspended: '2026-11-02', exited: '2026-11-03', exit: 'excluded' })
})
