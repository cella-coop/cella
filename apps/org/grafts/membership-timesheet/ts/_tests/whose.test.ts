// Whose time an entry is, as the members see it, on a database holding the
// app's core, the timesheet and membership feats and this graft: the guard
// on a log refuses time of a member suspended or gone, and leaves anyone
// else's to the timesheet feat's guards. Run by `cella test slice
// membership-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const whose = async (member: string) =>
  (await db.query<{ r: string | null }>('SELECT membership_timesheet.whose($1) AS r', [{ member, day: '2026-10-23' }])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO person.person (address, name) VALUES ('amina@x', 'Amina'), ('basile@x', 'Basile'), ('cleo@x', 'Cléo'), ('ines@x', 'Inès')`)
  await db.query(
    `INSERT INTO membership.member (address, status, since, suspended, exited) VALUES
       ('amina@x', 'active', '2024-01-10', NULL, NULL),
       ('basile@x', 'suspended', '2024-01-10', '2025-06-01', NULL),
       ('cleo@x', 'exited', '2024-01-10', NULL, '2025-12-31'),
       ('ines@x', 'invited', NULL, NULL, NULL)`,
  )
})

after(async () => {
  await db.end()
})

test('a member suspended or gone logs no time', async () => {
  assert.match((await whose('basile@x')) ?? '', /basile@x is a member suspended or gone: they log no time/)
  assert.match((await whose('cleo@x')) ?? '', /cleo@x is a member suspended or gone/)
})

test('an active member, one invited and someone who is no member are not this graft\'s to refuse', async () => {
  assert.equal(await whose('amina@x'), null)
  assert.equal(await whose('ines@x'), null)
  assert.equal(await whose('nobody@x'), null)
})

test('the guard runs on the log, and no trigger of this graft\'s is on the entries', async () => {
  const { rows } = await db.query(`SELECT op FROM cella.guard WHERE fn = 'membership_timesheet.whose(jsonb)'::regprocedure`)
  assert.deepEqual(rows, [{ op: 'timesheet:entry:log' }])
  const triggers = await db.query(`SELECT tgname FROM pg_trigger WHERE tgrelid = 'timesheet.entry'::regclass AND tgname = 'whose'`)
  assert.deepEqual(triggers.rows, [])
})
