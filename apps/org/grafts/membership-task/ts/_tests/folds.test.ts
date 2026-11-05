// The membership-task graft's fold (`sql/004-folds.sql`), on a database
// holding the app's core, the task and member feats and this graft, in a
// transaction rolled back after: a task folds given to the member its
// entry names, given again to another, and taken from them where it
// names none. Run by `cella test slice membership-task`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const camille = 'camille@folded.example'

const fold = (n: number, payload: unknown) =>
  db.query('SELECT membership_task.fold_assign($1)', [{ n, op: 'membership-task:task:assign', actor: camille, date: '2041-01-15', cause: null, payload }])
const assignee = async () => (await db.query(`SELECT member FROM membership_task.assignment WHERE task = 't-9001'`)).rows

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  for (const [address, name] of [[sacha, 'Sacha Folded'], [camille, 'Camille Folded']]) {
    await db.query(
      `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, $2) ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2020-01-02', 1)`,
      [address, name],
    )
  }
  await db.query(`INSERT INTO task.task (id, title, created) VALUES ('t-9001', 'Fold the board', '2041-01-14')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a task folds assigned, reassigned and unassigned', async () => {
  await fold(1, { task: 't-9001', member: sacha })
  assert.deepEqual(await assignee(), [{ member: sacha }])
  await fold(2, { task: 't-9001', member: camille })
  assert.deepEqual(await assignee(), [{ member: camille }])
  await fold(3, { task: 't-9001', member: null })
  assert.deepEqual(await assignee(), [])
})
