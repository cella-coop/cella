// cella migrate's run is one transaction: on a database with its views
// published, a migration that fails and a contract that fails each leave
// it the migrations it had and the views published before, which
// cella_analytics reads as it did. It runs on the dev cluster, by the PG*
// variables `cella test tools` sets, in a database of its own, over a tree
// of one feat in a directory of its own, the migrate tool copied into it.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const DB = 'cella_tools'
const tree = mkdtempSync(join(tmpdir(), 'cella-migrate-'))
const sql = join(tree, 'apps/org/feats/ledger/core/sql')

const write = (file, text) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const migrate = () => spawnSync(process.execPath, [join(tree, 'tools/migrate.mjs')], { env: { ...process.env, PGDATABASE: DB }, encoding: 'utf8' })
// A query on the test's database, as the analytics role if it is named.
async function query(text, role) {
  const db = new pg.Client({ database: DB })
  await db.connect()
  try {
    if (role) {
      await db.query(`SET ROLE ${role}`)
    }
    return (await db.query(text)).rows
  } finally {
    await db.end()
  }
}
// What a failed run must leave: the migrations the database had, none of
// the run's, and the view published before, read as the role.
async function asFound(applied) {
  assert.deepEqual(await query('SELECT id FROM migration.applied ORDER BY id'), applied)
  assert.deepEqual(await query(`SELECT to_regclass('ledger.more') AS more`), [{ more: null }])
  assert.deepEqual(await query('SELECT amount FROM ledger.total', 'cella_analytics'), [{ amount: '150' }])
}

const contract = 'CREATE VIEW ledger.total AS SELECT sum(l.amount)::bigint AS amount FROM ledger.line l;\n'
const more = `CREATE TABLE ledger.more (x int);\nINSERT INTO ledger.line VALUES ('2026-11-06', 1);\n`
let found

before(async () => {
  const admin = new pg.Client()
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${DB}`)
  await admin.end()
  mkdirSync(join(tree, 'tools'))
  for (const tool of ['migrate.mjs', 'migrations.mjs']) {
    copyFileSync(join(repo, 'tools', tool), join(tree, 'tools', tool))
  }
  symlinkSync(join(repo, 'node_modules'), join(tree, 'node_modules'))
  write(join(tree, 'apps/org/feat.toml'), 'name = "org"\n')
  write(join(tree, 'apps/org/feats/ledger/feat.toml'), 'name = "ledger"\n')
  write(join(tree, 'apps/org/core/sql/001-role.sql'), `DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cella_analytics') THEN
    CREATE ROLE cella_analytics LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;\n`)
  write(join(sql, '001-ledger.sql'), `CREATE SCHEMA ledger;
CREATE TABLE ledger.line (day date, amount bigint);
INSERT INTO ledger.line VALUES ('2026-11-05', 120), ('2026-11-05', 30);\n`)
  write(join(sql, 'analytics.sql'), contract)
  const run = migrate()
  assert.equal(run.status, 0, run.stderr)
  found = await query('SELECT id FROM migration.applied ORDER BY id')
  assert.equal(found.length, 2)
  await asFound(found)
})

after(async () => {
  const admin = new pg.Client()
  await admin.connect()
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`)
  await admin.end()
  rmSync(tree, { recursive: true, force: true })
})

test('a migration that fails rolls back the run, the views dropped and the migrations before it', async () => {
  write(join(sql, '002-more.sql'), more)
  write(join(sql, '003-broken.sql'), 'SELECT 1 / 0;\n')
  const run = migrate()
  assert.equal(run.status, 1)
  assert.match(run.stderr, /003-broken.sql: division by zero/)
  await asFound(found)
  rmSync(join(sql, '003-broken.sql'))
})

test('a contract that fails rolls back the run, the migrations and the views dropped and made', async () => {
  write(join(sql, 'analytics.sql'), `${contract}CREATE VIEW ledger.clock AS SELECT now()::time AS at;\n`)
  const run = migrate()
  assert.equal(run.status, 1)
  assert.match(run.stderr, /ledger.clock.at is time without time zone/)
  await asFound(found)
  assert.deepEqual(await query(`SELECT to_regclass('ledger.clock') AS clock`), [{ clock: null }])
})

test('the run that mends it applies the migration and publishes the views again', async () => {
  write(join(sql, 'analytics.sql'), contract)
  const run = migrate()
  assert.equal(run.status, 0, run.stderr)
  assert.equal((await query('SELECT id FROM migration.applied')).length, 3)
  assert.deepEqual(await query('SELECT amount FROM ledger.total', 'cella_analytics'), [{ amount: '151' }])
})
