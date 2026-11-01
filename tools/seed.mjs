// seed: founds a mock co-op from its fixture's directory, as the log's
// first entry, the founding (the import feat's `circle-membership-motion:scope:found`), which
// carries the state the mock co-op held before its log with it
// (`seed/found.mjs`).
// It connects to DATABASE_URL if set, otherwise by the PG* variables.
// Usage: node tools/seed.mjs apps/org/fixtures/<co-op>

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'smol-toml'
import pg from 'pg'
import { seed } from './seed/found.mjs'

const dir = process.argv[2]
const read = (file) => {
  const path = join(dir, `${file}.toml`)
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const { outcome, said } = await seed(db, read, { from: basename(dir), dir })
if (outcome.state !== 'settled') {
  throw new Error(`${basename(dir)} was not founded: ${outcome.state === 'refused' ? outcome.reason : outcome.state}`)
}
await db.end()
console.log(`seed: ${said} into ${db.database}, founded as log entry ${outcome.entry}`)
