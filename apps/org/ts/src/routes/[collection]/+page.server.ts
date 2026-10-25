import { error, type Actions } from '@sveltejs/kit'
import { aggregate, defaults, fields, matches, resolve, wheres, widgets, type Field, type Spec } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { mounted, rows as read, writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'
import { columns, dashboard, look, views } from '#lib/slices.ts'
import type { PageServerLoad } from './$types'

// A collection: its owner's rows and those its extensions add, as the
// acting member sees them, with the fields its extensions add to each, what its header says about it, each enumeration's values, and the
// view the address asks for, checked against the collection's fields:
// its tabs with how many rows each keeps, and, in the dashboard layout,
// its widgets run over the rows it keeps.
export const load: PageServerLoad = async ({ params, url, locals }) => {
  const m = mounted(params.collection)
  if (!m) {
    error(404, `There is no collection ${params.collection}`)
  }
  const fs = fields(columns(params.collection))
  const tabs = views(params.collection)
  const looks = look(params.collection)
  const { id, spec, errors } = resolve(url.searchParams, tabs, fs, looks)
  const today = new Date().toISOString().slice(0, 10)
  return using(async (db) => {
    const rows = await read(db, params.collection, locals.actor)
    const values = Object.fromEntries(
      fs.filter((f) => f.type === 'enum').map((f) => [f.key, [...new Set(rows.map((r) => String(f.value(r) ?? '')))].filter(Boolean).sort()]),
    )
    const count = (where: unknown) => rows.filter((r) => matches(r, wheres(where, fs), fs, today)).length
    const abouts = (await Promise.all(m.extensions.map((e) => e.extension.about?.(db, locals.actor)))).filter((a) => a !== undefined)
    const own = (await m.collection.about?.(db, locals.actor)) ?? null
    return {
      name: params.collection,
      rows,
      about: abouts.length ? Object.assign({}, own, ...abouts) : own,
      values,
      today,
      views: tabs.map((p) => ({ ...p, count: count(p.where) })),
      view: id,
      spec,
      look: looks,
      errors,
      dashboard: spec.layout === 'dashboard' ? run(spec, rows, fs, params.collection, today) : null,
    }
  })
}

function run(spec: Spec, rows: any[], fs: Field[], name: string, today: string) {
  const checked = spec.widgets ? { widgets: spec.widgets, errors: [] } : widgets(dashboard(name) ?? defaults(fs), fs)
  const kept = rows.filter((r) => matches(r, spec.where, fs, today))
  return {
    custom: spec.widgets !== null,
    widgets: checked.widgets,
    results: aggregate(checked.widgets, kept, fs, today),
    errors: checked.errors,
  }
}

export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w)]),
) satisfies Actions
