// The project feat's folds (`sql/004-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// project started as its entry names it, its milestones under their
// numbers in its circle, one completed keeping its first day, its budget
// set, and an archive that freezes it. Run by `cella test slice project`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, payload: unknown) =>
  db.query(`SELECT project.${fn}($1)`, [{ n, op, actor: sacha, date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('folded', 'Folded')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a project folds as its entry names it, and its milestones under their numbers in its circle', async () => {
  await fold('fold_create', 1, 'project:project:create', {
    project: 'folded-shop', circle: 'folded', started: '2041-02-03', title: 'Folded, shop', summary: 'A shop.', due: '2041-06-30',
  })
  await fold('fold_add', 2, 'project:milestone:add', { project: 'folded-shop', circle: 'folded', n: 1, title: 'Design', due: null })
  await fold('fold_add', 3, 'project:milestone:add', { project: 'folded-shop', circle: 'folded', n: 2, title: 'Build', due: '2041-05-01' })
  assert.deepEqual(
    await one(`SELECT title, circle, summary, to_char(started, 'YYYY-MM-DD') AS started, to_char(due, 'YYYY-MM-DD') AS due, budget, archived
               FROM project.project WHERE id = 'folded-shop'`),
    { title: 'Folded, shop', circle: 'folded', summary: 'A shop.', started: '2041-02-03', due: '2041-06-30', budget: null, archived: null },
  )
  assert.deepEqual((await db.query(`SELECT n, title, circle, to_char(due, 'YYYY-MM-DD') AS due FROM project.milestone WHERE project = 'folded-shop' ORDER BY n`)).rows, [
    { n: 1, title: 'Design', circle: 'folded', due: null },
    { n: 2, title: 'Build', circle: 'folded', due: '2041-05-01' },
  ])
})

test('a milestone folds complete keeping its first day, a budget set, and an archive that freezes the project', async () => {
  await fold('fold_complete', 4, 'project:milestone:complete', { project: 'folded-shop', circle: 'folded', n: 1, completed: '2041-03-01' })
  await fold('fold_complete', 5, 'project:milestone:complete', { project: 'folded-shop', circle: 'folded', n: 1, completed: '2041-03-09' })
  assert.deepEqual(await one(`SELECT to_char(completed, 'YYYY-MM-DD') AS completed FROM project.milestone WHERE project = 'folded-shop' AND n = 1`), { completed: '2041-03-01' })
  await fold('fold_budget', 6, 'project:project:budget', { project: 'folded-shop', amount: 950000, circle: 'folded' })
  assert.deepEqual(await one(`SELECT cella.cents(budget) AS cents FROM project.project WHERE id = 'folded-shop'`), { cents: '950000' })
  await fold('fold_archive', 7, 'project:project:archive', { project: 'folded-shop', circle: 'folded', archived: '2041-04-01' })
  await fold('fold_archive', 8, 'project:project:archive', { project: 'folded-shop', circle: 'folded', archived: '2041-04-01' })
  assert.deepEqual(await one(`SELECT to_char(archived, 'YYYY-MM-DD') AS archived FROM project.project WHERE id = 'folded-shop'`), { archived: '2041-04-01' })
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold('fold_budget', 9, 'project:project:budget', { project: 'folded-shop', amount: 1, circle: 'folded' }), /was archived on/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
