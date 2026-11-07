// The import feat's fold (`sql/002-folds.sql`), on a database holding the
// app's core and this feat, in a transaction rolled back after: a run
// recorded under the id its entry names, by its actor on its day, with
// its counts and its lines, and one whose counts do not add up refused by
// the table, as its handler's would be. Run by `cella test slice import`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'

const fold = (n: number, payload: unknown) =>
  db.query(`SELECT import.fold_record($1)`, [{ n, op: 'import:run:record', actor: sacha, date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a run folds under its id, by its actor on its day, with its counts and lines, and one whose counts do not add up is refused', async () => {
  const lines = [
    { line: 2, label: 'folded-site', op: 'project:project:create', state: 'settled', entry: 7 },
    { line: 3, label: 'folded-shop', op: 'project:project:create', state: 'refused', reason: 'a project folded-shop exists already' },
  ]
  await fold(1, { run: 'im-9001', kind: 'projects', dry: false, settled: 1, refused: 1, name: 'projects.csv', lines })
  assert.deepEqual(
    (await db.query(`SELECT id, kind, name, actor, to_char(day, 'YYYY-MM-DD') AS day, dry, settled, refused, lines FROM import.run WHERE id = 'im-9001'`)).rows,
    [{ id: 'im-9001', kind: 'projects', name: 'projects.csv', actor: sacha, day: '2041-02-03', dry: false, settled: 1, refused: 1, lines }],
  )
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold(2, { run: 'im-9002', kind: 'projects', dry: true, settled: 2, refused: 1, name: 'projects.csv', lines }), /run_check/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
