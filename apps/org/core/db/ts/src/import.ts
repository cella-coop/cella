import type { Db, Deps } from './index.ts'
import { done, type Done, type Imported } from './slice.ts'

// What one record of an imported file came to: the line it was read
// from, what it is, and its write's outcome.
export interface Line {
  line: number
  label: string
  done: Done
}

// A connection on which each write's transaction is a savepoint inside
// one transaction, so a dry run's writes meet their rules and the notary
// as they would, and are all undone at its end.
const savepoints: Record<string, string> = { BEGIN: 'SAVEPOINT imported', COMMIT: 'RELEASE SAVEPOINT imported', ROLLBACK: 'ROLLBACK TO SAVEPOINT imported' }

const nested = (db: Db): Db => ({
  query: <R>(text: string, values?: unknown[]) => db.query<R>(savepoints[text.trim()] ?? text, values),
})

// Runs an imported file's records as writes, in the file's order, as the
// importing member: each settles, or is refused with the rule's reason,
// alone. A dry run makes every write and undoes them all, so it says what
// would be created and what refused.
export async function importing(records: Imported[], deps: Deps, dry: boolean): Promise<Line[]> {
  const db = dry ? nested(deps.db) : deps.db
  const lines: Line[] = []
  if (dry) {
    await deps.db.query('BEGIN')
  }
  try {
    for (const r of records) {
      const line = { line: r.line, label: r.label }
      if (!r.run) {
        lines.push({ ...line, done: { op: r.op, state: 'failed', reason: r.refused ?? 'this line cannot be read', then: [] } })
        continue
      }
      try {
        lines.push({ ...line, done: done(r.op, await r.run({ ...deps, db })) })
      } catch (e) {
        lines.push({ ...line, done: { op: r.op, state: 'failed', reason: (e as Error).message, then: [] } })
      }
    }
  } finally {
    if (dry) {
      await deps.db.query('ROLLBACK')
    }
  }
  return lines
}

// A CSV file's records, each a row of its header's fields, by name, with
// the line it starts on: quoted fields may hold the separator, quotes
// doubled and line breaks; the separator is the header's comma, semicolon
// or tab, whichever it holds most of, so spreadsheets set to French write
// files it reads. A byte-order mark is dropped.
export function csv(text: string): { line: number; fields: Record<string, string> }[] {
  const body = text.replace(/^﻿/, '')
  const head = body.slice(0, body.indexOf('\n') === -1 ? body.length : body.indexOf('\n'))
  const count = (c: string) => head.split(c).length
  const sep = [',', ';', '\t'].reduce((a, b) => (count(b) > count(a) ? b : a))
  const rows: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let start = 1
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        if (c === '\n') {
          line++
        }
        cell += c
      }
    } else if (c === '"' && cell === '') {
      quoted = true
    } else if (c === sep) {
      cells.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') {
        i++
      }
      cells.push(cell)
      rows.push({ line: start, cells })
      cells = []
      cell = ''
      line++
      start = line
    } else {
      cell += c
    }
  }
  if (cell !== '' || cells.length) {
    cells.push(cell)
    rows.push({ line: start, cells })
  }
  const [header, ...data] = rows.filter((r) => r.cells.some((c) => c.trim() !== ''))
  if (!header) {
    return []
  }
  const names = header.cells.map((c) => c.trim())
  return data.map((r) => ({ line: r.line, fields: Object.fromEntries(names.map((n, i) => [n, (r.cells[i] ?? '').trim()])) }))
}
