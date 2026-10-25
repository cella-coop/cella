import { error, type Actions } from '@sveltejs/kit'
import { read, today, type Db, type Source } from '@cella/org-db'
import { anchor, defaults, fields, period, resolve, wheres, widgets, type Field, type Spec } from '@cella/org-ui/models'
import { using } from '#lib/server/db.ts'
import { drawn, keeping, run } from '#lib/server/reads.ts'
import { mounted, source, writes } from '#lib/server/slices.ts'
import { perform } from '#lib/server/write.ts'
import { columns, dashboard, look, views } from '#lib/slices.ts'
import type { PageServerLoad } from './$types'

// A collection: the rows the view in the address keeps, its owner's and
// those its extensions add, as the acting member sees them, with the
// fields its extensions add to each, read in SQL a page at a time (`n`
// rows, in the collection's order), in one statement with how many it
// keeps, how many of those hold the text filter, its tabs' counts and
// each enumeration's values; what its header says about it; and, in the
// dashboard layout, its widgets run over the rows it keeps. A board
// places every row the view keeps, a calendar those on the days it shows,
// and a dashboard draws none.
export const load: PageServerLoad = async ({ params, url, locals }) => {
  const m = mounted(params.collection)
  const from = source(params.collection)
  if (!m || !from) {
    error(404, `There is no collection ${params.collection}`)
  }
  const fs = fields(columns(params.collection))
  const tabs = views(params.collection)
  const looks = look(params.collection)
  const { id, spec, errors } = resolve(url.searchParams, tabs, fs, looks)
  const limit = drawn(url)
  const keeps = keeping(spec, fs)
  return using(locals.actor, async (db) => {
    const day = await today(db)
    const paged = spec.layout === 'list' || spec.layout === 'table' || spec.layout === 'gallery'
    const { rows, counts, values } = await read(db, from, {
      ...(spec.layout === 'dashboard' ? {} : { keep: placing(spec, fs, url, day) ?? keeps, ...(paged ? { limit } : {}) }),
      counts: [{ where: spec.where }, keeps, ...tabs.map((p) => ({ where: wheres(p.where, fs) }))],
      values: fs.filter((f) => f.type === 'enum').map((f) => f.key),
    })
    const [kept = 0, matched = 0, ...tallies] = counts
    const abouts = (await Promise.all(m.extensions.map((e) => e.extension.about?.(db, locals.actor)))).filter((a) => a !== undefined)
    const own = (await m.collection.about?.(db, locals.actor)) ?? null
    return {
      name: params.collection,
      rows,
      kept,
      matched,
      about: abouts.length ? Object.assign({}, own, ...abouts) : own,
      values,
      today: day,
      views: tabs.map((p, i) => ({ ...p, count: tallies[i] ?? 0 })),
      view: id,
      spec,
      look: looks,
      errors,
      dashboard: spec.layout === 'dashboard' ? await measured(db, from, spec, fs, params.collection) : null,
    }
  })
}

// In a calendar, the rows the view keeps on the days it shows: the month
// or week around the day the address is at, else today's, by the date it
// places them by, the first when the view names none.
function placing(spec: Spec, fs: Field[], url: URL, today: string) {
  const on = fs.find((f) => f.key === spec.on) ?? fs.find((f) => f.type === 'date')
  if (spec.layout !== 'calendar' || !on) {
    return undefined
  }
  const { days } = period(anchor(url.searchParams.get('at'), today), spec.span, today)
  return { ...keeping(spec, fs), where: [...spec.where, { field: on.key, from: days[0]?.day ?? today, to: days.at(-1)?.day ?? today }] }
}

// The dashboard: the view's widgets, else the collection's, else the
// defaults, each run over the rows the view keeps.
async function measured(db: Db, from: Source, spec: Spec, fs: Field[], name: string) {
  const checked = spec.widgets ? { widgets: spec.widgets, errors: [] } : widgets(dashboard(name) ?? defaults(fs), fs)
  return {
    custom: spec.widgets !== null,
    widgets: checked.widgets,
    results: await run(db, from, checked.widgets, spec.where, fs),
    errors: checked.errors,
  }
}

export const actions = Object.fromEntries(
  writes.map((w) => [w, (event: Parameters<Actions[string]>[0]) => perform(event, event.params.collection ?? '', w)]),
) satisfies Actions
