// The task feat's folds (`sql/005-folds.sql`), on a database holding the
// app's core and this feat, in a transaction rolled back after: a task
// folds created under its id on the entry's day, its title as its
// commitment; moved, completed keeping its first day, and reopened; its
// body set to each save's snapshot, one with no canonical form refused. Run
// by `cella test slice task`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

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

test('a body folds saved as the snapshot its entry carries, and a later save replaces it', async () => {
  const body = (text: string) => {
    const doc = createDoc(7n)
    edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
    doc.commit()
    return doc.export({ mode: 'snapshot' })
  }
  const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
  await fold('fold_create', 6, 'task:task:create', '2041-01-20', { task: 't-9002', created: '2041-01-20', title: commitment, priority: 'normal', due: null, status: 'todo' })
  const first = body('Check the payment provider’s sandbox')
  await fold('fold_body_save', 7, 'task:body:save', '2041-01-20', { task: 't-9002', circle: 'ag', snapshot: hex(first), contributors: [sacha] })
  const saved = async () => (await one<{ body: Buffer; text: string }>(`SELECT body, cella.document_text(body) AS text FROM task.task WHERE id = 't-9002'`))
  assert.equal(hex((await saved()).body), hex(first))
  assert.match((await saved()).text, /payment provider’s sandbox/)
  const second = body('Go live on Monday')
  await fold('fold_body_save', 8, 'task:body:save', '2041-01-21', { task: 't-9002', circle: 'ag', snapshot: hex(second), contributors: [] })
  assert.equal(hex((await saved()).body), hex(second))
})

test('a body with no canonical form is refused by its column', async () => {
  await db.query('SAVEPOINT bad')
  await assert.rejects(db.query(`UPDATE task.task SET body = '\\x00ff'::bytea WHERE id = 't-9002'`))
  await db.query('ROLLBACK TO SAVEPOINT bad')
})

test('a save naming a contributor who holds no discuss in the task’s circle is refused, and says who', async () => {
  const guard = async (contributors: string[]) =>
    (await one<{ why: string | null }>(`SELECT task.contributed($1) AS why`, [{ task: 't-9002', circle: 'ag', snapshot: '', contributors }])).why
  assert.equal(await guard([]), null)
  assert.match((await guard([sacha])) ?? '', /holds no discuss in ag: sacha@folded\.example; a mandate granting it there/)
})
