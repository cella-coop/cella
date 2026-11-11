// migrate: applies each node's SQL down the feat tree — a node's core
// (core/sql/, the notary's, then its core feats' by name, which read no
// other and so take no order among themselves, then its core grafts',
// lowest order first), then its feats, recursively, then its grafts,
// lowest order first — each directory's NNN-*.sql files in order.
// Applied files are recorded by their stable id (`migrations.mjs`)
// with their hash in migration.applied. Until launch a migration is
// rewritten in place and every database rebuilt, so a database that
// applied a file since edited is refused before anything runs, with the
// words to reset it, never re-run. A database that recorded them by path
// is moved to ids on its first run. It connects to DATABASE_URL if set,
// otherwise by the PG* variables.
//
// `--slice <name>` applies one slice's part of the tree alone, for its
// slice tests: the app's core and the cores of the feats a slice nests in,
// then a feat's own tree, or a graft's feats, its lower-order grafts at or
// below its node and itself; a library of the app's core, `circle`, its
// core alone. A slice whose SQL reaches past what it may read fails to
// migrate here.
//
// Then the analytical contracts: each slice's `sql/analytics.sql`, its
// views, is no migration and is applied whole after them, in tree order,
// whenever a migration ran or a contract changed. The views published
// before are dropped first, so a migration never meets one, and each view
// a contract makes is granted to `cella_analytics`, with USAGE on its
// schema; the role reads nothing else. Each is then read as that role,
// and a view it cannot read, or a column of a type that is not plain,
// fails the run. The analytics port, org's core library, publishes one too,
// in its own schema: `analytics.head`, the log's head; and so do core's
// circles, in theirs.
//
// Then every table a feat or a graft makes is read for the reading rule:
// a run that leaves one not under row-level security, enabled and forced,
// or with no policy the app role reads it by, fails (`circle.unsecured`).
//
// The run is one transaction, from the drop to the last read as the role:
// a migration or a contract that fails rolls it all back, so the database
// keeps the migrations it had and the views published before, and the
// role reads them as it did.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { edited, idOf } from './migrations.mjs'

// A slice's analytical contract, beside its migrations, and the role that
// reads the views it publishes.
const CONTRACT = 'analytics.sql'
const ROLE = 'cella_analytics'
// The column types a contract shares: what any client reads, never the
// notary's own types.
const PLAIN = new Set(['bigint', 'integer', 'smallint', 'numeric', 'text', 'boolean', 'date', 'timestamp with time zone', 'jsonb', 'text[]'])
// A contract's schema: its feat's name, its graft's with underscores, or
// the analytics port's own, `analytics`.
const schemaOf = (file) => {
  const parts = relative(repo, file).split('/')
  if (parts.at(-4) === 'core' && parts.at(-3) === 'analytics') {
    return 'analytics'
  }
  return parts.at(-3) === 'core' ? parts.at(-4) : parts.at(-3).replaceAll('-', '_')
}

const repo = fileURLToPath(new URL('..', import.meta.url))
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()
const sorted = (dir) => (isDir(dir) ? readdirSync(dir).sort() : [])
const isNode = (dir) => existsSync(join(dir, 'feat.toml'))

// A graft reads the grafts that join fewer of its feats, so grafts migrate
// by order: those joining two feats first, then three, each order by name.
const order = (g) => g.split('-').length
const byOrder = (grafts) => grafts.sort((a, b) => order(a) - order(b) || a.localeCompare(b))

// A core feat's SQL calls the notary's and reads no other core feat's, so
// core's feats follow the notary by name, in no order of their own; core's
// grafts, which join its feats, run after every one, lowest order first.
const core = (node) => {
  const feats = sorted(join(node, 'core')).filter((lib) => lib !== 'grafts' && lib !== 'notary' && isDir(join(node, 'core', lib, 'sql')))
  return [
    join(node, 'core', 'sql'),
    join(node, 'core', 'notary', 'sql'),
    ...feats.map((lib) => join(node, 'core', lib, 'sql')),
    ...byOrder(sorted(join(node, 'core', 'grafts'))).map((g) => join(node, 'core', 'grafts', g, 'sql')),
  ]
}
const feats = (node) => sorted(join(node, 'feats')).map((f) => join(node, 'feats', f)).filter(isNode)
const grafts = (node) => byOrder(sorted(join(node, 'grafts')))

const tree = (node) => [
  ...core(node),
  ...feats(node).flatMap(tree),
  ...grafts(node).map((g) => join(node, 'grafts', g, 'sql')),
]

// Every node below a node, outermost first, and the nodes a node nests in
// below the app.
const below = (node) => feats(node).flatMap((f) => [f, ...below(f)])
const nest = (app, node) => below(app).filter((n) => node.startsWith(join(n, 'feats') + '/'))
// Every graft at a node or below, with the node that holds it.
const held = (node) => [...grafts(node).map((g) => ({ g, node })), ...feats(node).flatMap(held)]

// One slice's part of an app: the app's core and the cores of the feats
// the slice nests in, then the slice's own SQL and what it reads. Null when
// the app has no slice of that name.
const part = (app, name) => {
  if (name !== 'grafts' && (isDir(join(app, 'core', name)) || isDir(join(app, 'core', 'grafts', name)))) {
    return core(app)
  }
  const feat = below(app).find((f) => basename(f) === name)
  if (feat) {
    return [...core(app), ...nest(app, feat).flatMap(core), ...tree(feat)]
  }
  const graft = held(app).find((x) => x.g === name)
  if (!graft) {
    return null
  }
  const joined = name.split('-').map((f) => below(app).find((n) => basename(n) === f))
  const lower = byOrder(held(graft.node).map((x) => x.g).filter((g) => order(g) < joined.length && g.split('-').every((f) => name.split('-').includes(f))))
  return [...new Set([
    ...core(app),
    ...joined.flatMap((f) => [...nest(app, f).flatMap(core), ...tree(f)]),
    ...[...lower, name].map((g) => join(held(app).find((x) => x.g === g).node, 'grafts', g, 'sql')),
  ])]
}

const args = process.argv.slice(2)
const at = args.indexOf('--slice')
const slice = at >= 0 ? args[at + 1] : null
if (at >= 0 && !slice) {
  console.error('migrate: --slice takes a feat or graft name')
  process.exit(2)
}

const apps = sorted(join(repo, 'apps')).map((a) => join(repo, 'apps', a)).filter(isNode)
const dirs = slice ? apps.map((a) => part(a, slice)).find(Boolean) : apps.flatMap(tree)
if (!dirs) {
  console.error(`migrate: no feat or graft ${slice}`)
  process.exit(2)
}
const files = dirs
  .filter(isDir)
  .flatMap((dir) => sorted(dir).filter((f) => /^\d{3}-.+\.sql$/.test(f)).map((f) => join(dir, f)))
const hashOf = (sql) => createHash('sha256').update(sql).digest('hex')
// A slice publishes one, in a feat's core/sql/ or a graft's sql/, and so
// does the analytics port, org's core library, for the log's head.
const contracts = dirs
  .filter((dir) => /\/(feats\/[^/]+\/core|grafts\/[^/]+|apps\/[^/]+\/core\/(analytics|circle))\/sql$/.test(dir) && existsSync(join(dir, CONTRACT)))
  .map((dir) => join(dir, CONTRACT))

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
// Rolls the run back and fails it.
const fail = async (message) => {
  await db.query('ROLLBACK')
  console.error(`migrate: ${message}`)
  await db.end()
  process.exit(1)
}
await db.query('BEGIN')
await db.query(`
  CREATE SCHEMA IF NOT EXISTS migration;
  CREATE TABLE IF NOT EXISTS migration.applied (
    id text PRIMARY KEY,
    hash text NOT NULL,
    at timestamptz NOT NULL DEFAULT now()
  )`)
// A database that recorded its migrations by path moves to their ids.
const byPath = await db.query(`SELECT FROM information_schema.columns WHERE table_schema = 'migration' AND table_name = 'applied' AND column_name = 'path'`)
if (byPath.rowCount) {
  await db.query('ALTER TABLE migration.applied RENAME COLUMN path TO id')
  for (const { id } of (await db.query('SELECT id FROM migration.applied')).rows) {
    await db.query('UPDATE migration.applied SET id = $1 WHERE id = $2', [idOf(id), id])
  }
  console.log('migrate: the applied set moved from paths to ids')
}
await db.query('CREATE TABLE IF NOT EXISTS migration.contract (one boolean PRIMARY KEY DEFAULT true CHECK (one), hash text NOT NULL)')
const applied = new Map((await db.query('SELECT id, hash FROM migration.applied')).rows.map((r) => [r.id, r.hash]))
const refused = edited(applied, files.map((f) => ({ path: relative(repo, f), id: idOf(relative(repo, f)), hash: hashOf(readFileSync(f, 'utf8')) })), { whole: !slice })
if (refused.length) {
  await fail(refused.join('\nmigrate: '))
}

// What this run's contracts hash to, by id and text, and whether they are
// to be published again: after any migration, or when one changed.
const published = hashOf(contracts.map((f) => `${idOf(relative(repo, f))}\n${readFileSync(f, 'utf8')}`).join('\0'))
const recorded = (await db.query('SELECT hash FROM migration.contract')).rows[0]?.hash
const republish = files.some((f) => !applied.has(idOf(relative(repo, f)))) || recorded !== published
// Every view granted to the role.
const granted = async () => (await db.query(`
  SELECT format('%I.%I', n.nspname, c.relname) AS view
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'v' AND EXISTS (SELECT FROM aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee WHERE r.rolname = $1)
  ORDER BY 1`, [ROLE])).rows.map((r) => r.view)
if (republish) {
  const old = await granted()
  if (old.length) {
    // A contract's view may read another's, so they go together.
    await db.query(`DROP VIEW IF EXISTS ${old.join(', ')} CASCADE`)
  }
}

let ran = 0
for (const file of files) {
  const path = relative(repo, file)
  const id = idOf(path)
  const sql = readFileSync(file, 'utf8')
  const hash = hashOf(sql)
  if (applied.has(id)) {
    continue
  }
  try {
    // A migration changes the schema and its registries, a superuser's
    // act, not a write: the notary's trigger lets its rows through.
    await db.query('SET LOCAL cella.unbound = on')
    await db.query(sql)
    await db.query('INSERT INTO migration.applied (id, hash) VALUES ($1, $2)', [id, hash])
  } catch (e) {
    await fail(`${path}: ${e.message}`)
  }
  console.log(`migrate: ${path}`)
  ran++
}
if (republish) {
  try {
    await publish()
  } catch (e) {
    await fail(e.message)
  }
}
// Every table a feat or a graft makes is under row-level security,
// forced, with a policy the app role reads it by, as core's circles make
// it: a run that leaves one escaping fails.
if ((await db.query(`SELECT to_regprocedure('circle.unsecured()') AS f`)).rows[0].f) {
  const unsecured = (await db.query('SELECT circle.unsecured() AS t')).rows.map((r) => r.t)
  if (unsecured.length) {
    await fail(unsecured.join('\nmigrate: '))
  }
}
try {
  await db.query('COMMIT')
} catch (e) {
  await fail(e.message)
}
await db.end()
console.log(`migrate: ${ran} applied, ${files.length - ran} already in ${db.database}${slice ? `, slice ${slice}` : ''}`)

// Applies every contract, grants each view it makes, and reads each as
// the role, as the analytics shell will.
async function publish() {
  const made = async (schema) => (await db.query(`
    SELECT format('%I.%I', n.nspname, c.relname) AS view
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = $1`, [schema])).rows.map((r) => r.view)
  for (const file of contracts) {
    const schema = schemaOf(file)
    const had = new Set(await made(schema))
    try {
      await db.query(readFileSync(file, 'utf8'))
    } catch (e) {
      throw new Error(`${relative(repo, file)}: ${e.message}`)
    }
    const views = (await made(schema)).filter((v) => !had.has(v))
    if (views.length) {
      await db.query(`GRANT USAGE ON SCHEMA ${schema} TO ${ROLE}`)
      await db.query(`GRANT SELECT ON ${views.join(', ')} TO ${ROLE}`)
    }
  }
  const views = await granted()
  await db.query(`SET LOCAL ROLE ${ROLE}`)
  for (const view of views) {
    try {
      await db.query(`SELECT count(*) FROM (SELECT * FROM ${view}) v`)
    } catch (e) {
      throw new Error(`${view}: ${ROLE} cannot read it: ${e.message}`)
    }
  }
  await db.query('RESET ROLE')
  const typed = await db.query(`
    SELECT format('%I.%I', n.nspname, c.relname) AS view, a.attname AS col, format_type(a.atttypid, NULL) AS type
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE format('%I.%I', n.nspname, c.relname) = ANY($1) AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY 1, a.attnum`, [views])
  const odd = typed.rows.find((t) => !PLAIN.has(t.type))
  if (odd) {
    throw new Error(`${odd.view}.${odd.col} is ${odd.type}: a contract shares plain types (${[...PLAIN].join(', ')}); unwrap an amount with cella.cents`)
  }
  await db.query('DELETE FROM migration.contract')
  await db.query('INSERT INTO migration.contract (hash) VALUES ($1)', [published])
  if (contracts.length) {
    console.log(`migrate: ${contracts.length} analytical contracts, ${views.length} views granted to ${ROLE}`)
  }
}
