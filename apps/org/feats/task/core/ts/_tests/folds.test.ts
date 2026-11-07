// The task feat's folds (`sql/005-folds.sql`), on a database holding the
// app's core and this feat, in a transaction rolled back after: a task
// folds created under its id on the entry's day, its title as its
// commitment; moved, completed keeping its first day, and reopened. Run
// by `cella test slice task`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, date: string, payload: unknown) =>
  db.query(`SELECT task.${fn}($1)`, [{ n, op, actor: sacha, date, cause: null, payload }])
const task = () =>
  one(`SELECT title, status, priority, to_char(due, 'YYYY-MM-DD') AS due, to_char(created, 'YYYY-MM-DD') AS created, to_char(completed, 'YYYY-MM-DD') AS completed FROM task.task WHERE id = 't-9001'`)

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a task folds created, moved, completed and reopened', async () => {
  await fold('fold_create', 1, 'task:task:create', '2041-01-15', { task: 't-9001', created: '2041-01-15', title: commitment, priority: 'high', due: '2041-02-01', status: 'todo' })
  assert.deepEqual(await task(), { title: 'redacted', status: 'todo', priority: 'high', due: '2041-02-01', created: '2041-01-15', completed: null })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE field = 'task.task.title' AND subject = 't-9001'`)).n, '1')
  await fold('fold_move', 2, 'task:task:move', '2041-01-16', { task: 't-9001', status: 'doing', completed: null })
  await fold('fold_complete', 3, 'task:task:complete', '2041-01-17', { task: 't-9001', status: 'done', completed: '2041-01-17' })
  await fold('fold_complete', 4, 'task:task:complete', '2041-01-18', { task: 't-9001', status: 'done', completed: '2041-01-17' })
  assert.deepEqual(await task(), { title: 'redacted', status: 'done', priority: 'high', due: '2041-02-01', created: '2041-01-15', completed: '2041-01-17' })
  await fold('fold_move', 5, 'task:task:move', '2041-01-19', { task: 't-9001', status: 'todo', completed: null })
  assert.deepEqual(await task(), { title: 'redacted', status: 'todo', priority: 'high', due: '2041-02-01', created: '2041-01-15', completed: null })
})
