import type { Db, Deps } from './index.ts'
import { done, type Done, type Imported } from './slice.ts'

// What one record of an imported file came to: the line it was read
// from, what it is, and its write's outcome.
export interface Line {
  line: number
  label: string
  done: Done
}

// A connection on which each write's transaction is rolled back where it
// would commit: a dry run's write meets its rules and the notary as it
// would, and leaves nothing. The notary takes one receipt for a
// transaction, so each write needs its own, and none sees another's.
const undone = (db: Db): Db => ({
  query: <R>(text: string, values?: unknown[]) => db.query<R>(text.trim() === 'COMMIT' ? 'ROLLBACK' : text, values),
})

// Runs an imported file's records as writes, in the file's order, as the
// importing member: each settles, or is refused with the rule's reason,
// alone. A dry run makes each write and undoes it, so it says what would
// be created and what refused, each line judged on the co-op as it
// stands; a settled line names no entry, since none stays.
export async function importing(records: Imported[], deps: Deps, dry: boolean): Promise<Line[]> {
  const db = dry ? undone(deps.db) : deps.db
  const lines: Line[] = []
  for (const r of records) {
    const line = { line: r.line, label: r.label }
    if (!r.run) {
      lines.push({ ...line, done: { op: r.op, state: 'failed', reason: r.refused ?? 'this line cannot be read', then: [] } })
      continue
    }
    try {
      const made = done(r.op, await r.run({ ...deps, db }))
      lines.push({ ...line, done: dry ? { ...made, entry: undefined } : made })
    } catch (e) {
      lines.push({ ...line, done: { op: r.op, state: 'failed', reason: (e as Error).message, then: [] } })
    }
  }
  return lines
}

// A CSV file's records, each a row of its header's fields, by name, with
// the line it starts on: quoted fields may hold the separator, quotes
// doubled and line breaks; the separator is the header's comma, semicolon,
// tab or bar, whichever it holds most of, so spreadsheets set to French
// and FEC files read alike. A byte-order mark is dropped.
export function csv(text: string): { line: number; fields: Record<string, string> }[] {
  const body = text.replace(/^\uFEFF/, '')
  const head = body.slice(0, body.indexOf('\n') === -1 ? body.length : body.indexOf('\n'))
  const count = (c: string) => head.split(c).length
  const sep = [',', ';', '\t', '|'].reduce((a, b) => (count(b) > count(a) ? b : a))
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
