// Every table a feat or a graft makes is under row-level security as it
// is made, enabled and forced: one naming its owning circle under the
// policy `circle`, a registry under `registry`, which every reader reads;
// and `circle.unsecured()`, which fails `cella migrate`, names a table
// that escapes it. On a database holding only the app's core and this
// library, in a transaction rolled back. Run by `cella test slice circle`.

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

test('a slice\'s table is forced under row-level security as it is made, by its circle or as a registry, and one that escapes is named', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
    await db.query(`CREATE SCHEMA ledger`)
    await db.query(`CREATE TABLE ledger.line (circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle, amount bigint)`)
    await db.query(`CREATE TABLE ledger.kind (id text PRIMARY KEY)`)
    const made = await db.query<{ t: string; secured: boolean; forced: boolean; policies: string[] }>(`
      SELECT c.relname AS t, c.relrowsecurity AS secured, c.relforcerowsecurity AS forced,
        ARRAY(SELECT p.polname::text FROM pg_policy p WHERE p.polrelid = c.oid ORDER BY 1) AS policies
      FROM pg_class c WHERE c.relnamespace = 'ledger'::regnamespace AND c.relkind = 'r' ORDER BY 1`)
    assert.deepEqual(made.rows, [
      { t: 'kind', secured: true, forced: true, policies: ['registry', 'registry_guards'] },
      { t: 'line', secured: true, forced: true, policies: ['circle', 'circle_guards'] },
    ])
    assert.deepEqual((await db.query('SELECT circle.unsecured() AS t')).rows, [])
    await db.query('ALTER TABLE ledger.line NO FORCE ROW LEVEL SECURITY')
    await db.query('DROP POLICY registry ON ledger.kind')
    assert.deepEqual((await db.query('SELECT circle.unsecured() AS t')).rows.map((r) => r.t), [
      'ledger.kind has no policy the app role reads by',
      'ledger.line does not force row-level security',
    ])
    await db.query('ALTER TABLE ledger.line DISABLE ROW LEVEL SECURITY')
    assert.match((await db.query('SELECT circle.unsecured() AS t')).rows[1].t, /ledger.line is not under row-level security/)
  } finally {
    await db.query('ROLLBACK')
  }
})
