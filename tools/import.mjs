// import: brings a file from another tool into a scope, as a member,
// through the same signed writes the Imports page makes: each record is
// read by the slice whose write it is, submitted as the importing member
// and judged by the rules, or, with --dry-run, every write is made and
// then undone, to say what would be created and what refused. The run is
// recorded in the import feat either way. The member signs with their
// TEST-ONLY fixture device, as the dev server does, so it imports for the
// mock co-ops alone until members' own devices sign.
// It connects as the app's role to DATABASE_URL if set, otherwise by the
// PG* variables.
// Usage: node tools/import.mjs <kind> <file> <address> [--dry-run]

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import pg from 'pg'
import { kinds, imported } from '../apps/org/ts/src/lib/server/import.ts'
import { signing } from '../apps/org/ts/src/lib/server/fixture.ts'

const [kind, file, actor] = process.argv.slice(2)
const dry = process.argv.includes('--dry-run')
if (!kinds().some((k) => k.kind === kind)) {
  console.error(`there is no import of ${kind}; there are:`)
  for (const k of kinds()) {
    console.error(`  ${k.kind.padEnd(9)} ${k.formats}`)
  }
  process.exit(2)
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, user: process.env.DATABASE_URL ? undefined : 'cella_app' })
await db.connect()
try {
  // It reads as the importing member, as the server reads for the signed-in one.
  await db.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
  const deps = await signing(db, actor)
  if (typeof deps === 'string') {
    console.error(deps)
    process.exit(1)
  }
  const { lines, done } = await imported(deps, kind, basename(file), readFileSync(file), dry)
  for (const l of lines) {
    const outcome = l.done.state === 'settled' ? (l.done.entry ? `settled, entry ${l.done.entry}` : 'would settle') : `${l.done.state}: ${l.done.reason ?? ''}`
    console.log(`line ${String(l.line).padStart(4)}  ${l.done.op.padEnd(36)} ${l.label}  ${outcome}`)
  }
  const settled = lines.filter((l) => l.done.state === 'settled' || l.done.state === 'pending').length
  const would = dry ? 'would settle' : 'settled'
  if (done.state !== 'settled') {
    console.error(`the run was not recorded: ${done.reason ?? done.state}`)
    process.exit(1)
  }
  console.log(`${basename(file)}: ${settled} ${would}, ${lines.length - settled} refused${dry ? ', all undone' : ''}; recorded at log entry ${done.entry}`)
} finally {
  await db.end()
}
