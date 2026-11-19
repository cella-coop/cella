// states: each slice's statuses, declared in its models/status.ts as a
// lifecycle the UI kit draws (`Lifecycle`, `@cella/org-ui/models`): the
// column it is, `<table>.<column>` in the slice's own schema, and its
// states in order, each in one of the five categories. The SQL keeps its
// own list, the CHECK on that column; this keeps the two equal, refusing
// a value one lists and the other does not, a lifecycle naming a column
// no CHECK lists, a value declared twice and a category the kit does not
// know, each by file and line. No schema change: the database is the
// truth, the lifecycle its mirror for the interface.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const categories = ['backlog', 'unstarted', 'started', 'completed', 'cancelled']

// The line of a file a text first appears on, 1 where it does not.
const lineOf = (text, needle) => {
  const at = text.indexOf(needle)
  return at < 0 ? 1 : text.slice(0, at).split('\n').length
}

// Every lifecycle each slice's models/status.ts exports, imported as the
// TypeScript reads it, by the schema it is in. `slices` lists each
// package's directory with its schema.
export async function lifecycles(repo, slices) {
  const out = []
  for (const { dir, schema } of slices) {
    const file = join(dir, 'src', 'models', 'status.ts')
    if (!existsSync(join(repo, file))) {
      continue
    }
    const text = readFileSync(join(repo, file), 'utf8')
    const mod = await import(pathToFileURL(join(repo, file)).href)
    for (const [name, l] of Object.entries(mod)) {
      if (l && typeof l.column === 'string' && Array.isArray(l.states)) {
        out.push({ name, schema, file, line: lineOf(text, `column: '${l.column}'`), column: l.column, states: l.states })
      }
    }
  }
  return out
}

// Where a lifecycle and its column's CHECK disagree. `listed` holds each
// CHECK sql-check found listing a column's values, by `schema.table.column`.
export function agreeStates(declared, listed) {
  const errors = []
  const checks = new Map(listed.map((c) => [c.key, c]))
  const seen = new Map()
  for (const l of declared) {
    const at = `${l.file}:${l.line}`
    const key = `${l.schema}.${l.column}`
    if (seen.has(key)) {
      errors.push(`${at}: ${l.name} declares ${key}'s states again, after ${seen.get(key)}`)
      continue
    }
    seen.set(key, l.name)
    if (l.column.split('.').length !== 2) {
      errors.push(`${at}: ${l.name}'s column is ${l.column}; it names <table>.<column> in the slice's own schema, ${l.schema}`)
      continue
    }
    const values = l.states.map((s) => s.value)
    for (const v of new Set(values.filter((v, i) => values.indexOf(v) !== i))) {
      errors.push(`${at}: ${l.name} declares the state ${v} twice`)
    }
    for (const s of l.states.filter((s) => !categories.includes(s.category))) {
      errors.push(`${at}: ${l.name}'s state ${s.value} is in the category ${s.category}, which is none of ${categories.join(', ')}`)
    }
    const c = checks.get(key)
    if (!c) {
      errors.push(`${at}: ${l.name} declares ${key}'s states, but no CHECK of ${l.schema}'s SQL lists that column's values (${key} IN (…))`)
      continue
    }
    const missing = c.values.filter((v) => !values.includes(v))
    const extra = values.filter((v) => !c.values.includes(v))
    if (missing.length) {
      errors.push(`${at}: ${l.name} leaves out ${missing.join(', ')}, which the CHECK on ${key} at ${c.path}:${c.line} allows; declare each with its category`)
    }
    if (extra.length) {
      errors.push(`${at}: ${l.name} declares ${extra.join(', ')}, which the CHECK on ${key} at ${c.path}:${c.line} refuses; add it there or drop it here`)
    }
  }
  return errors
}
