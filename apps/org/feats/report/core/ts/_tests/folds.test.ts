// The report feat's fold (`sql/002-folds.sql`), on a database holding the
// app's core and this feat, in a transaction rolled back after: a save
// folds the actor's report as its entry keeps it, saved on the entry's
// day, saved again over their own, and never over another's. Run by
// `cella test slice report`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const definition = { fields: ['month'], measures: { minutes: 'sum' } }

const fold = (n: number, actor: string, date: string, title: string) =>
  db.query('SELECT report.fold_save($1)', [{ n, op: 'report:report:save', actor, date, cause: null, payload: { report: 'folded-hours', title, caption: 'Hours by month', definition } }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a save folds the actor\'s report on its day, again over their own, and never over another\'s', async () => {
  await fold(1, sacha, '2041-02-03', 'Hours')
  await fold(2, sacha, '2041-02-04', 'Hours worked')
  await fold(3, 'other@folded.example', '2041-02-05', 'Not theirs')
  assert.deepEqual((await db.query(`SELECT title, caption, definition, owner, to_char(saved, 'YYYY-MM-DD') AS saved FROM report.report WHERE id = 'folded-hours'`)).rows, [
    { title: 'Hours worked', caption: 'Hours by month', definition, owner: sacha, saved: '2041-02-04' },
  ])
})
