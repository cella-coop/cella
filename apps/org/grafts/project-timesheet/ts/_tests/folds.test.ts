// project-timesheet's fold (`sql/004-folds.sql`), on a database holding
// the app's core, the project and timesheet feats and this graft, in a
// transaction rolled back after: an entry the timesheet feat's fold logged
// booked to the project its entry names, one naming none left the co-op's
// own, and one booked to an archived project refused as its handler's
// was. Run by `cella test slice project-timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = { $commit: 'ab'.repeat(32) }

// Both folds of a log, the feat's then the graft's, as `cella.fold_log`
// runs them.
const fold = async (n: number, payload: Record<string, unknown>) => {
  const entry = { n, op: 'timesheet:entry:log', actor: sacha, date: '2041-01-15', cause: null, payload }
  await db.query('SELECT timesheet.fold_log($1)', [entry])
  await db.query('SELECT project_timesheet.fold_log($1)', [entry])
}
const logged = (entry: string, project?: string) => ({
  entry, circle: 'ag', member: sacha, day: '2041-01-15', minutes: commitment, billable: true, note: commitment, ...(project ? { project } : {}),
})

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO project.project (id, title, started) VALUES ('folded-site', 'Folded, site', '2041-01-02')`)
  await db.query(`INSERT INTO project.project (id, title, started, archived) VALUES ('folded-past', 'Folded, past', '2040-01-02', '2040-12-31')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an entry folds booked to the project its entry names, one naming none the co-op\'s own, one to an archived project refused', async () => {
  await fold(1, logged('9001', 'folded-site'))
  await fold(2, logged('9002'))
  assert.deepEqual((await db.query(`SELECT entry, project FROM project_timesheet.booking WHERE entry IN (9001, 9002)`)).rows, [
    { entry: '9001', project: 'folded-site' },
  ])
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold(3, logged('9003', 'folded-past')), /folded-past was archived on 2040-12-31: it takes no time/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
