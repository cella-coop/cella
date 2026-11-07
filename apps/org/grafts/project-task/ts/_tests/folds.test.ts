// The project-task graft's folds (`sql/003-folds.sql`), on a database
// holding the app's core, the project and task feats and this graft, in a
// transaction rolled back after: a task created on a project's page folds
// filed under the project and milestone its entry names, one created in
// none is filed nowhere, and a filing folds moving a task. Run by `cella
// test slice project-task`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const fold = (fn: string, n: number, op: string, payload: unknown) =>
  db.query(`SELECT project_task.${fn}($1)`, [{ n, op, actor: 'sacha@folded.example', date: '2041-01-15', cause: null, payload }])
const filed = async () => (await db.query(`SELECT task, project, milestone FROM project_task.filing WHERE task LIKE 't-900%' ORDER BY task`)).rows

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO project.project (id, title, started) VALUES ('folding', 'Folding', '2041-01-01'), ('refolding', 'Refolding', '2041-01-01')`)
  await db.query(`INSERT INTO project.milestone (project, n, title) VALUES ('folding', 1, 'Proofs')`)
  await db.query(`INSERT INTO task.task (id, title, created) VALUES ('t-9001', 'Fold the proofs', '2041-01-15'), ('t-9002', 'Fold alone', '2041-01-15')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a creation on a project\'s page folds filed; a filing folds moving it', async () => {
  await fold('fold_create', 1, 'task:task:create', { task: 't-9001', created: '2041-01-15', project: 'folding', milestone: 1 })
  await fold('fold_create', 2, 'task:task:create', { task: 't-9002', created: '2041-01-15' })
  assert.deepEqual(await filed(), [{ task: 't-9001', project: 'folding', milestone: 1 }])
  await fold('fold_file', 3, 'project-task:task:file', { task: 't-9001', project: 'refolding' })
  await fold('fold_file', 4, 'project-task:task:file', { task: 't-9002', project: 'folding', milestone: 1 })
  assert.deepEqual(await filed(), [
    { task: 't-9001', project: 'refolding', milestone: null },
    { task: 't-9002', project: 'folding', milestone: 1 },
  ])
})
