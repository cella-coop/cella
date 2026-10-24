import { error, type Actions } from '@sveltejs/kit'
import { aggregate, defaults, fields, widgets } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { mounted, writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'
import { columns, dashboard } from '#lib/slices.ts'
import type { PageServerLoad } from './$types'

// A collection: its owner's rows, with the fields its extensions add to
// each, what its header says about it, each enumeration's values, and,
// in the dashboard view, its widgets run over the rows: the address's
// own, checked against the collection's fields, or else the declared or
// derived defaults.
export const load: PageServerLoad = async ({ params, url }) => {
  const m = mounted(params.collection)
  if (!m) {
    error(404, `There is no collection ${params.collection}`)
  }
  const fs = fields(columns(params.collection))
  const board = url.searchParams.get('view') === 'dashboard'
  const raw = url.searchParams.get('w')
  return using(async (db) => {
    const owned = await m.collection.list(db)
    const added = await Promise.all(m.extensions.map((e) => e.extension.list?.(db)))
    const rows = owned.map((r) => Object.assign({}, r, ...added.map((a) => a?.[r.id])))
    const values = Object.fromEntries(
      fs.filter((f) => f.type === 'enum').map((f) => [f.key, [...new Set(rows.map((r) => String(f.value(r) ?? '')))].filter(Boolean).sort()]),
    )
    return {
      name: params.collection,
      rows,
      about: (await m.collection.about?.(db)) ?? null,
      values,
      dashboard: board ? run(raw, rows, fs, params.collection) : null,
    }
  })
}

function run(raw: string | null, rows: any[], fs: ReturnType<typeof fields>, name: string) {
  let config: unknown = dashboard(name) ?? defaults(fs)
  const errors: string[] = []
  if (raw) {
    try {
      config = JSON.parse(raw)
    } catch {
      errors.push('the dashboard in the address is not JSON; showing the defaults')
    }
  }
  const checked = widgets(config, fs)
  const today = new Date().toISOString().slice(0, 10)
  return {
    custom: raw !== null && !errors.length,
    widgets: checked.widgets,
    results: aggregate(checked.widgets, rows, fs, today),
    errors: [...errors, ...checked.errors],
  }
}

export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w)]),
) satisfies Actions
