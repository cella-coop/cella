// migrate: applies each node's SQL down the feat tree — a node's core
// (core/sql/, then core/<lib>/sql/), then its feats, recursively, then its
// grafts, lowest order first — each directory's NNN-*.sql files in order, one transaction per
// file. Applied files are recorded by their stable id (`migrations.mjs`)
// with their hash in migration.applied; a file edited after it was
// applied is refused, never re-run. A database that recorded them by path
// is moved to ids on its first run. It connects to DATABASE_URL if set,
// otherwise by the PG* variables.
//
// `--slice <name>` applies one slice's part of the tree alone, for its
// slice tests: the app's core and the cores of the feats a slice nests in,
// then a feat's own tree, or a graft's feats, its lower-order grafts at or
// below its node and itself. A slice whose SQL reaches past what
// it may read fails to migrate here.
//
// `--locked` checks, with no database, that every app's migrations are
// append-only against its `migrations.lock`; `--lock` adds the new ones.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { LOCK, formatLock, idOf, parseLock, unlocked } from './migrations.mjs'

const repo = fileURLToPath(new URL('..', import.meta.url))
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()
const sorted = (dir) => (isDir(dir) ? readdirSync(dir).sort() : [])
const isNode = (dir) => existsSync(join(dir, 'feat.toml'))

// A graft reads the grafts that join fewer of its feats, so grafts migrate
// by order: those joining two feats first, then three, each order by name.
const order = (g) => g.split('-').length
const byOrder = (grafts) => grafts.sort((a, b) => order(a) - order(b) || a.localeCompare(b))

const core = (node) => [join(node, 'core', 'sql'), ...sorted(join(node, 'core')).map((lib) => join(node, 'core', lib, 'sql'))]
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
const locking = args.includes('--lock') ? 'lock' : args.includes('--locked') ? 'locked' : null
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

if (locking) {
  let errors = []
  let added = 0
  let count = 0
  for (const app of apps) {
    const lockPath = join(app, LOCK)
    const lock = parseLock(existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : '')
    const mine = files
      .filter((f) => f.startsWith(app + '/'))
      .map((f) => ({ path: relative(repo, f), id: idOf(relative(repo, f)), hash: hashOf(readFileSync(f, 'utf8')) }))
    count += mine.length
    const found = unlocked(lock, mine)
    if (locking === 'locked') {
      errors = errors.concat(found)
      continue
    }
    const fresh = mine.filter((f) => !lock.has(f.id))
    errors = errors.concat(found.filter((e) => !/is not locked/.test(e)))
    for (const f of fresh) {
      lock.set(f.id, f.hash)
      console.log(`migrate: locked ${f.id}`)
    }
    added += fresh.length
    if (fresh.length && !errors.length) {
      writeFileSync(lockPath, formatLock(lock))
    }
  }
  for (const e of errors) {
    console.error(`migrate: ${e}`)
  }
  if (errors.length) {
    process.exit(1)
  }
  console.log(locking === 'lock' ? `migrate: ${added} locked, ${count - added} already` : `migrate: ${count} migrations locked, append-only`)
  process.exit(0)
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
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
  await db.query('BEGIN')
  await db.query('ALTER TABLE migration.applied RENAME COLUMN path TO id')
  for (const { id } of (await db.query('SELECT id FROM migration.applied')).rows) {
    await db.query('UPDATE migration.applied SET id = $1 WHERE id = $2', [idOf(id), id])
  }
  await db.query('COMMIT')
  console.log('migrate: the applied set moved from paths to ids')
}
const applied = new Map((await db.query('SELECT id, hash FROM migration.applied')).rows.map((r) => [r.id, r.hash]))

let ran = 0
for (const file of files) {
  const path = relative(repo, file)
  const id = idOf(path)
  const sql = readFileSync(file, 'utf8')
  const hash = hashOf(sql)
  if (applied.has(id)) {
    if (applied.get(id) !== hash) {
      console.error(`migrate: ${path} (${id}) changed after it was applied; add a new migration instead`)
      process.exit(1)
    }
    continue
  }
  try {
    await db.query('BEGIN')
    // A migration changes the schema and its registries, a superuser's
    // act, not a write: the notary's trigger lets its rows through.
    await db.query('SET LOCAL cella.unbound = on')
    await db.query(sql)
    await db.query('INSERT INTO migration.applied (id, hash) VALUES ($1, $2)', [id, hash])
    await db.query('COMMIT')
  } catch (e) {
    await db.query('ROLLBACK')
    console.error(`migrate: ${path}: ${e.message}`)
    process.exit(1)
  }
  console.log(`migrate: ${path}`)
  ran++
}
await db.end()
console.log(`migrate: ${ran} applied, ${files.length - ran} already in ${db.database}${slice ? `, slice ${slice}` : ''}`)
