// The saved reports alone, on a database holding only the app's core and
// this feat: the four the feat draws itself are there, owned by no one; a
// member saves a custom report under their own address on the verdict
// date and saves it again; another's, a built-in one and one reading no
// view are refused by the guard; the thresholds are published. What a
// report reads through the port is the e2e scenario `reports`'s. Run by
// `cella test slice report`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { write, type Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { report, reports, saving, slug } from '../src/api/index.ts'
import type { Save } from '../src/models/report.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@test.example'
const sofia = 'sofia@test.example'
const as = (actor: string): Deps => ({ db, actor, sign: signer(scope, actor, fixture(actor, 'laptop')) })

const budgets: Save = {
  id: 'budgets-by-circle',
  title: 'Budgets by circle',
  caption: '',
  definition: { from: { p: 'project.projects' }, fields: ['p.circle'], measures: { budget: { fn: 'sum', of: 'p.budget' } }, chart: { by: 'p.circle', value: 'budget' } },
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-30'`)
  await db.query(`SET cella.scope = '${scope}'`)
  // Any device signs for anyone, in place of core person's keyring.
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query('DELETE FROM cella.keyring')
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('account', 'project', 'expense_invoice_project_timesheet')`)
  assert.deepEqual(rows, [])
})

test('the four reports the feat draws itself are there, owned by no one', async () => {
  const all = await reports(db)
  assert.deepEqual(
    all.map((r) => [r.id, r.kind, r.owner]),
    [
      ['income', 'income', null],
      ['balance', 'balance', null],
      ['margins', 'margins', null],
      ['federation', 'federation', null],
    ],
  )
})

test('a member saves a custom report as their own on the verdict date, and saves it again', async () => {
  const out = await write(as(camille), saving(budgets, camille))
  assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
  const saved = await report(db, budgets.id)
  assert.equal(saved?.owner, camille)
  assert.equal(saved?.saved, '2026-10-30')
  assert.deepEqual(saved?.definition, budgets.definition)
  const again = await write(as(camille), saving({ ...budgets, caption: 'Each circle\'s projects\' budgets' }, camille))
  assert.equal(again.state, 'settled', again.state === 'refused' ? again.reason : '')
  assert.equal((await report(db, budgets.id))?.caption, 'Each circle\'s projects\' budgets')
  assert.equal(slug('Marges par cercle, 2026'), 'marges-par-cercle-2026')
})

test('another member\'s report, a built-in one and one reading no view are refused', async () => {
  const theirs = await write(as(sofia), saving({ ...budgets, title: 'Mine now' }, sofia))
  assert.equal(theirs.state, 'refused')
  assert.match(theirs.state === 'refused' ? theirs.reason : '', /budgets-by-circle is camille@test\.example's report, not sofia@test\.example's/)
  assert.equal((await report(db, budgets.id))?.title, 'Budgets by circle')
  const builtin = await write(as(sofia), saving({ ...budgets, id: 'margins' }, sofia))
  assert.equal(builtin.state, 'refused')
  assert.match(builtin.state === 'refused' ? builtin.reason : '', /margins is a report the feat draws itself/)
  const empty = await write(as(sofia), saving({ ...budgets, id: 'nothing', definition: { from: {} } }, sofia))
  assert.equal(empty.state, 'refused')
  assert.match(empty.state === 'refused' ? empty.reason : '', /nothing reads no view/)
  assert.equal(await report(db, 'nothing'), null)
})

test('the thresholds are published to the analytics role, and nothing else of the feat', async () => {
  await db.query(`INSERT INTO report.threshold (since, burn, margin) VALUES ('2026-01-01', 90, 20)`)
  const analytics = new pg.Client({ user: 'cella_analytics' })
  await analytics.connect()
  try {
    assert.deepEqual((await analytics.query('SELECT since::text, burn, margin FROM report.thresholds')).rows, [{ since: '2026-01-01', burn: '90', margin: '20' }])
    await assert.rejects(analytics.query('SELECT * FROM report.report'), /permission denied/)
  } finally {
    await analytics.end()
  }
})
