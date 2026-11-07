// membership-project's fold (`sql/004-folds.sql`), on a database holding
// the app's core, the member and project feats and this graft, in a
// transaction rolled back after: a share granted under the id, the
// amount and the day its entry names, and one beyond what is left of the
// budget refused as its handler's was. Run by `cella test slice
// membership-project`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'

const fold = (n: number, payload: unknown) =>
  db.query(`SELECT membership_project.fold_share($1)`, [{ n, op: 'membership-project:project:share', actor: sacha, date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`SELECT set_config('cella.clock', '2041-02-03', true)`)
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Sacha Folded')) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2040-03-01', 1)`, [sacha])
  await db.query(`INSERT INTO project.project (id, title, started, budget) VALUES ('folded-site', 'Folded, site', '2041-01-02', cella.amount(100000))`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a share folds under the id, the amount and the day its entry names, and one beyond the budget is refused', async () => {
  await fold(1, { project: 'folded-site', member: sacha, amount: 60000, circle: 'assembly', share: 9001, granted: '2041-02-03' })
  assert.deepEqual((await db.query(`SELECT id, project, member, cella.cents(amount) AS cents, to_char(granted, 'YYYY-MM-DD') AS granted FROM membership_project.share WHERE project = 'folded-site'`)).rows, [
    { id: '9001', project: 'folded-site', member: sacha, cents: '60000', granted: '2041-02-03' },
  ])
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold(2, { project: 'folded-site', member: sacha, amount: 60000, circle: 'assembly', share: 9002, granted: '2041-02-03' }), /exceeds what is left of folded-site's budget, 40000 of 100000 cents/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
