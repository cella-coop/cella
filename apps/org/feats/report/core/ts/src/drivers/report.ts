import type { Analytics } from '@cella/org-analytics'
import { today, type Db, type Read } from '@cella/org-db'
import type { Drawn, Report } from '../models/report.ts'
import { chosen, spans, statement } from './statement.ts'
import { margins } from './margin.ts'
import { federation } from './federation.ts'
import { custom } from './custom.ts'

const kinds = `array_position(ARRAY['income', 'balance', 'margins', 'federation', 'custom'], kind)`

// The saved reports as the collection lists them: the four the feat draws
// itself first, then the members' own by title.
export const listing: Read = {
  sql: `SELECT id, title, caption, kind, owner, to_char(saved, 'YYYY-MM-DD') AS saved FROM report.listed`,
  order: `${kinds}, title`,
}

export async function reports(db: Db): Promise<Report[]> {
  const { rows } = await db.query<Report>(
    `SELECT id, title, caption, kind, definition, owner, to_char(saved, 'YYYY-MM-DD') AS saved FROM report.listed ORDER BY ${kinds}, title`,
  )
  return rows
}

export async function report(db: Db, id: string): Promise<Report | null> {
  const { rows } = await db.query<Report>(
    `SELECT id, title, caption, kind, definition, owner, to_char(saved, 'YYYY-MM-DD') AS saved FROM report.listed WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

// A saved report drawn through the port, with the log's head it read: a
// statement over the span the address names (`span`), the federation
// figures of the year it names (`year`). What the port or the shell
// refuses is said, and the page draws nothing.
export async function draw(port: Analytics, db: Db, id: string, query?: URLSearchParams): Promise<Drawn | null> {
  const saved = await report(db, id)
  if (!saved) {
    return null
  }
  try {
    switch (saved.kind) {
      case 'income':
      case 'balance': {
        const all = await spans(port)
        const span = chosen(all, query?.get('span') ?? null, await today(db))
        if (!span) {
          return { report: saved, head: null, drawn: null, failed: 'The books hold no period yet.' }
        }
        const { head, rubrics } = await statement(port, saved.kind, span)
        return {
          report: saved,
          head,
          drawn: { sheet: saved.kind, span, columns: [span.id, span.before], rubrics, spans: all.map((s) => ({ id: s.id, kind: s.kind })) },
        }
      }
      case 'margins': {
        const { head, margins: drawn } = await margins(port)
        return { report: saved, head, drawn }
      }
      case 'federation': {
        const year = Number(query?.get('year'))
        const { head, federation: drawn } = await federation(port, Number.isInteger(year) && year > 0 ? year : null)
        return { report: saved, head, drawn }
      }
      case 'custom': {
        const { head, custom: drawn } = await custom(port, saved.definition ?? { from: {} })
        return { report: saved, head, drawn }
      }
    }
  } catch (e) {
    return { report: saved, head: null, drawn: null, failed: (e as Error).message }
  }
}
