// Foreign writes: a feat's rows change only through its own code, and a
// graft writes only its own schema, changing a feat by calling that feat's
// published write from its handler. sql-check.mjs collects what a slice's
// SQL still writes or triggers on a table it does not own, net of what a
// later migration drops or replaces; `scanTs` does the same for the SQL a
// slice's TypeScript sends. `refuse` refuses every one of both: there
// are no exceptions.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// A statement that writes a table, or a trigger on one, as TypeScript
// spells SQL: the keyword in capitals, the table qualified.
const dml = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?)\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/g
const trigger = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+[a-z_]+[^;`'"]*?\bON\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/g

const sources = (dir) => {
  const out = []
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const path = join(dir, name)
    if (['_tests', '_e2e', 'node_modules'].includes(name)) {
      continue
    }
    if (statSync(path).isDirectory()) {
      out.push(...sources(path))
    } else if (/\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

// Each foreign write or trigger in the TypeScript of a slice's package:
// `own` is its schema, and only `cella.*` beside it, which the notary
// guards, is not foreign.
export function scanTs(repo, dir, owner, own) {
  const out = []
  for (const file of sources(join(repo, dir, 'src'))) {
    const text = readFileSync(file, 'utf8')
    for (const [re, verb] of [[dml, 'writes'], [trigger, 'triggers on']]) {
      for (const m of text.matchAll(re)) {
        if (m[1] !== own && m[1] !== 'cella') {
          const at = relative(repo, file)
          out.push({ owner, what: `${relative(join(repo, dir), file)} ${verb} ${m[1]}.${m[2]}`, path: at })
        }
      }
    }
  }
  return out
}

// Every foreign write found, refused.
export function refuse(found) {
  return found.map((f) => `${f.path}: ${f.owner} ${f.what}, a table it does not own: a slice writes only its own schema, and changes a feat only by calling that feat's published write`)
}
