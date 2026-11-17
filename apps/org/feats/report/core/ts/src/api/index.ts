// The feat's public write, its reads, and its slice, which the shell
// mounts, made with the analytics port the server hands it at assembly.
import { scoped, type Analytics } from '@cella/org-analytics'
import { action, type Slice } from '@cella/org-db'
import type { Saved } from '../models/report.ts'
import { save } from '../handlers/index.ts'
import { draw, listing, reports } from '../drivers/report.ts'
import { margins } from '../drivers/margin.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount } from './body.ts'
import { bodied } from '../drivers/body.ts'

export { save, saving } from '../handlers/index.ts'
export { draw, report, reports } from '../drivers/report.ts'
export { chosen, spans, statement } from '../drivers/statement.ts'
export { margins, threshold, watch } from '../drivers/margin.ts'
export { federation } from '../drivers/federation.ts'
export { custom } from '../drivers/custom.ts'
export { saveBody } from '../handlers/body.ts'

// A custom report's id from its title: lowercase words joined by hyphens.
export const slug = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// What the New form's definition says, as JSON; text that is no object
// is refused before the port reads it.
const definition = (text: string): Saved => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('a report\'s definition is JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('a report\'s definition is a JSON object')
  }
  return parsed as Saved
}

// The saved reports, each drawn on its page through the port, and saving
// a member's own.
export function reporting(port: Analytics): Slice {
  return {
    name: 'report',
    queries: contract,
    collections: {
      reports: {
        list: listing,
        // Drawn is nested (its id and title are `report.id`/`report.title`,
        // not its own): flattened here so the body's editor, which reads a
        // record's id and title at its own top level, finds them.
        item: async (db, id, query) => {
          const drawn = await draw(scoped(port, db), db, id, query)
          return drawn && { ...drawn, id: drawn.report.id, title: drawn.report.title, ...(await bodied(db, id)) }
        },
        index: async (db) => (await reports(db)).map((r) => ({ id: r.id, title: r.title, sub: r.kind })),
        body: bodyMount,
        actions: {
          ...bodyActions,
          save: action(
            'report:report:save',
            (form) => {
              const title = String(form.get('title') ?? '').trim()
              return { id: slug(title), title, caption: String(form.get('caption') ?? '').trim(), definition: definition(String(form.get('definition') ?? '')) }
            },
            (input, deps) => save(port, input, deps),
          ),
        },
      },
    },
  }
}
