// The tasks alone, on a database holding only the app's core and this
// feat: tasks number in order, a task is done exactly when it has its
// day, and each field is its own register. Run by `cella test slice task`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'membership_task', 'project', 'project_task')`)
  assert.deepEqual(rows, [])
})

test('tasks number in order, next and of normal priority unless said', async () => {
  const made = []
  for (const title of ['Order colour proofs', 'Press check at the printer']) {
    const { rows } = await db.query(`INSERT INTO task.task (title, created) VALUES ($1, '2026-10-12') RETURNING id, status, priority`, [title])
    made.push(rows[0])
  }
  assert.deepEqual(made, [
    { id: 't-1', status: 'next', priority: 'normal' },
    { id: 't-2', status: 'next', priority: 'normal' },
  ])
})

test('a task is done exactly when it has its completion day', async () => {
  for (const sql of [
    `UPDATE task.task SET status = 'done' WHERE id = 't-1'`,
    `UPDATE task.task SET completed = '2026-10-20' WHERE id = 't-1'`,
  ]) {
    await db.query('BEGIN')
    await assert.rejects(db.query(sql), /task_check/)
    await db.query('ROLLBACK')
  }
  await db.query(`UPDATE task.task SET status = 'done', completed = '2026-10-20' WHERE id = 't-1'`)
})

test('a status and a priority are known ones', async () => {
  for (const sql of [`UPDATE task.task SET status = 'blocked' WHERE id = 't-2'`, `UPDATE task.task SET priority = 'asap' WHERE id = 't-2'`]) {
    await db.query('BEGIN')
    await assert.rejects(db.query(sql), /violates check constraint/)
    await db.query('ROLLBACK')
  }
})

test('each field is its own register: a move and a reprioritising both stand', async () => {
  await db.query(`UPDATE task.task SET status = 'active' WHERE id = 't-2'`)
  await db.query(`UPDATE task.task SET priority = 'high' WHERE id = 't-2'`)
  const { rows } = await db.query(`SELECT status, priority FROM task.task WHERE id = 't-2'`)
  assert.deepEqual(rows[0], { status: 'active', priority: 'high' })
})

test('a change of priority or due is a write of its own, needing the power a move needs', async () => {
  const { rows } = await db.query(`SELECT op, power FROM cella.power WHERE op IN ('task:task:move', 'task:task:set') ORDER BY op`)
  assert.deepEqual(rows, [
    { op: 'task:task:move', power: 'edit-task' },
    { op: 'task:task:set', power: 'edit-task' },
  ])
})
