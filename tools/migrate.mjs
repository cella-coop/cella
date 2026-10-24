// migrate: applies each node's SQL down the feat tree — a node's core
// (core/sql/, then core/<lib>/sql/), then its feats, recursively, then its
// grafts — each directory's NNN-*.sql files in order, one transaction per
// file. Applied files are recorded with their hash in migration.applied;
// a file edited after it was applied is refused, never re-run.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import pg from 'pg'

const repo = process.cwd()
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()
const sorted = (dir) => (isDir(dir) ? readdirSync(dir).sort() : [])
const isNode = (dir) => existsSync(join(dir, 'feat.toml'))

const tree = (node) => [
  join(node, 'core', 'sql'),
  ...sorted(join(node, 'core')).map((lib) => join(node, 'core', lib, 'sql')),
  ...sorted(join(node, 'feats')).map((f) => join(node, 'feats', f)).filter(isNode).flatMap(tree),
  ...sorted(join(node, 'grafts')).map((g) => join(node, 'grafts', g, 'sql')),
]

const apps = sorted(join(repo, 'apps')).map((a) => join(repo, 'apps', a)).filter(isNode)
const files = apps
  .flatMap(tree)
  .filter(isDir)
  .flatMap((dir) => sorted(dir).filter((f) => /^\d{3}-.+\.sql$/.test(f)).map((f) => join(dir, f)))

const db = new pg.Client()
await db.connect()
await db.query(`
  CREATE SCHEMA IF NOT EXISTS migration;
  CREATE TABLE IF NOT EXISTS migration.applied (
    path text PRIMARY KEY,
    hash text NOT NULL,
    at timestamptz NOT NULL DEFAULT now()
  )`)
const applied = new Map((await db.query('SELECT path, hash FROM migration.applied')).rows.map((r) => [r.path, r.hash]))

let ran = 0
for (const file of files) {
  const path = relative(repo, file)
  const sql = readFileSync(file, 'utf8')
  const hash = createHash('sha256').update(sql).digest('hex')
  if (applied.has(path)) {
    if (applied.get(path) !== hash) {
      console.error(`migrate: ${path} changed after it was applied; add a new migration instead`)
      process.exit(1)
    }
    continue
  }
  try {
    await db.query('BEGIN')
    await db.query(sql)
    await db.query('INSERT INTO migration.applied (path, hash) VALUES ($1, $2)', [path, hash])
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
console.log(`migrate: ${ran} applied, ${files.length - ran} already in ${db.database}`)
