// contact-project's fold (`sql/003-folds.sql`), on a database holding the
// app's core, the contact and project feats and this graft, in a
// transaction rolled back after: a project linked to the client its
// entry names, linked again to another, and a link to a contact that is
// no client refused as its handler's was. Run by `cella test slice
// contact-project`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'

const fold = (n: number, payload: unknown) =>
  db.query(`SELECT contact_project.fold_link($1)`, [{ n, op: 'contact-project:project:link', actor: sacha, date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO contact.contact (id, name, client) VALUES ('folded-shop', 'Folded Shop', 'active'), ('folded-press', 'Folded Press', 'lead'), ('folded-mill', 'Folded Mill', NULL)`)
  await db.query(`INSERT INTO project.project (id, title, started) VALUES ('folded-site', 'Folded, site', '2041-01-02')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a project folds linked to the client its entry names, and linked again to another', async () => {
  await fold(1, { project: 'folded-site', contact: 'folded-shop', circle: 'assembly' })
  await fold(2, { project: 'folded-site', contact: 'folded-press', circle: 'assembly' })
  assert.deepEqual((await db.query(`SELECT project, contact FROM contact_project.commission WHERE project = 'folded-site'`)).rows, [
    { project: 'folded-site', contact: 'folded-press' },
  ])
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold(3, { project: 'folded-site', contact: 'folded-mill', circle: 'assembly' }), /folded-mill is no client/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})
