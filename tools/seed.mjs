// seed: founds a mock co-op from its fixture's directory, as the log's
// first entry, the founding (the import feat's `membership-motion:scope:found`), which
// carries the state the mock co-op held before its log with it
// (`seed/found.mjs`).
// It connects to DATABASE_URL if set, otherwise by the PG* variables.
// Usage: node tools/seed.mjs apps/org/fixtures/<co-op> [--scenario NAME]

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'smol-toml'
import pg from 'pg'
import { seed } from './seed/found.mjs'

const dir = process.argv[2]
const stories = ['governance', 'authority', 'mandate', 'provenance', 'procedure', 'chain', 'powers', 'grant', 'refusal', 'author', 'tenure', 'role-seat', 'collective', 'authority-walk']
const scenarios = []
for (let i = 3; i < process.argv.length; i += 2) {
  if (process.argv[i] !== '--scenario' || !stories.includes(process.argv[i + 1])) {
    throw new Error(`unknown scenario; available stories: ${stories.join(', ')}`)
  }
  scenarios.push(process.argv[i + 1])
}
if (scenarios.length > 1) {
  throw new Error('seed one story at a time; run cella db reset before seeding another')
}
if (scenarios.length && process.env.DATABASE_URL) {
  throw new Error('--scenario needs the dev cluster, not --url')
}
const read = (file) => {
  const path = join(dir, `${file}.toml`)
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  if (scenarios.length && (await db.query('SELECT EXISTS (SELECT FROM cella.log) AS seeded')).rows[0].seeded) {
    throw new Error('database already seeded; run cella db reset first')
  }
  const { outcome, said } = await seed(db, read, { from: basename(dir), dir })
  if (outcome.state !== 'settled') {
    throw new Error(`${basename(dir)} was not founded: ${outcome.state === 'refused' ? outcome.reason : outcome.state}`)
  }
  console.log(`seed: ${said} into ${db.database}, founded as log entry ${outcome.entry}`)
} finally {
  await db.end()
}
// Each story opens its own app connection and advances the dev clock as its
// test does. Import only after founding, and leave the resulting rows in place.
if (scenarios.length) {
  process.env.CELLA_STORY = '1'
  for (const name of scenarios) {
    const { story } = await import(`../apps/org/ts/_e2e/${name}.test.ts`)
    await story()
    console.log(`seed: ${name} story played`)
  }
}
