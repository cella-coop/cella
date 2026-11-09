import { counts, ordered, read, texts, today, type Db, type Source } from '@cella/org-db'
import { anchor, defaults, fields, period, resolve, wheres, widgets, type Field, type Spec } from '@cella/org-ui/models'
import { named } from '@cella/org-log/api'
import { people, person } from '@cella/org-person/api'
import { lensed, lensing } from '#lib/server/lens.ts'
import { drawn, keeping, run } from '#lib/server/reads.ts'
import { mounted, slices, source } from '#lib/server/slices.ts'
import { columns, counted, dashboard, look, views } from '#lib/slices.ts'

// The shell's queries over the slices' reads, as the slice registry
// mounts them: framework-free, each with the schema its argument is
// validated by, which the web shell serves as remote functions
// (`#lib/remote/`). Each runs on a connection the caller lends, reading as
// the session's person, so the row-level policies decide what it reads.

// What a call reads for: who, their cookies, which hold their lens, and
// the device they signed in on.
export interface Reader {
  actor: string | null
  session: { actor: string; device: string } | null
  cookies: { get(name: string): string | undefined }
}

// What is not there to read, or not the reader's: a transport answers it
// as a 404.
export class Missing extends Error {}

// A collection: the rows the view in the address keeps, its owner's and
// those its extensions add, as the acting member sees them, with the
// fields its extensions add to each, read in SQL a page at a time (`n`
// rows, in the collection's order), in one statement with how many it
// keeps, how many of those hold the text filter, its tabs' counts and
// each enumeration's values; the field its rows are ordered by first;
// what its header says about it; and, in the dashboard layout, its
// widgets run over the rows it keeps. A board places every row the view
// keeps, a calendar those on the days it shows, and a dashboard draws
// none. Under the member's lens it reads only the lensed circle's rows,
// and says where the lens leaves it whole. `search` is the page's
// address's query.
export const collection = {
  schema: texts(['name', 'search']),
  async run(db: Db, { name, search }: { name: string; search: string }, who: Reader) {
    const m = mounted(name)
    const named = source(name)
    if (!m || !named) {
      throw new Missing(`There is no collection ${name}`)
    }
    const url = new URLSearchParams(search)
    const fs = fields(columns(name))
    const tabs = views(name)
    const looks = look(name)
    const { id, spec, errors } = resolve(url, tabs, fs, looks)
    const limit = drawn(url)
    const keeps = keeping(spec, fs)
    // Its rows through the member's lens, where they have one.
    const from = source(name, await lensed(db, who.cookies, who.actor)) ?? named
    const day = await today(db)
    const paged = spec.layout === 'list' || spec.layout === 'feed' || spec.layout === 'table' || spec.layout === 'gallery'
    const { rows, counts, values, whole } = await read(db, from, {
      ...(spec.layout === 'dashboard' ? {} : { keep: placing(spec, fs, url, day) ?? keeps, ...(paged ? { limit } : {}) }),
      counts: [{ where: spec.where }, keeps, ...tabs.map((p) => ({ where: wheres(p.where, fs) }))],
      values: fs.filter((f) => f.type === 'enum').map((f) => f.key),
    })
    const [kept = 0, matched = 0, ...tallies] = counts
    const abouts = (await Promise.all(m.extensions.map((e) => e.extension.about?.(db, who.actor)))).filter((a) => a !== undefined)
    const own = (await m.collection.about?.(db, who.actor)) ?? null
    return {
      name,
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
      dashboard: spec.layout === 'dashboard' ? await measured(db, from, spec, fs, name) : null,
      sorted: ordered(from),
      // Whether the lens leaves the collection whole, its rows naming no
      // circle that owns them.
      whole,
    }
  },
}

// In a calendar, the rows the view keeps on the days it shows: the month
// or week around the day the address is at, else today's, by the date it
// places them by, the first when the view names none.
function placing(spec: Spec, fs: Field[], url: URLSearchParams, today: string) {
  const on = fs.find((f) => f.key === spec.on) ?? fs.find((f) => f.type === 'date')
  if (spec.layout !== 'calendar' || !on) {
    return undefined
  }
  const { days } = period(anchor(url.get('at'), today), spec.span, today)
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

// An item: its owner's data, given the address, and each extension's data
// on it, by slice, with who looks, for a block that offers what only the
// viewer may do. Of another circle's, it is none to the reader.
export const item = {
  schema: texts(['name', 'id', 'search']),
  async run(db: Db, { name, id, search }: { name: string; id: string; search: string }, who: Reader) {
    const m = mounted(name)
    const one = m?.collection.item
    if (!m || !one) {
      throw new Missing(`There is no collection ${name} with pages`)
    }
    const found = await one(db, id, new URLSearchParams(search))
    if (!found) {
      throw new Missing(`${name} has no ${id}`)
    }
    const added = await Promise.all(
      m.extensions.filter((e) => e.extension.item).map(async (e) => [e.slice.name, await e.extension.item?.(db, id, who.actor)] as const),
    )
    const viewer = who.session && { actor: who.session.actor, device: who.session.device }
    return { name, id, item: found, added: Object.fromEntries(added), viewer }
  },
}

// Every item the command menu can jump to, from each collection's index.
export const index = {
  async run(db: Db) {
    const names = slices.flatMap((s) => Object.keys(s.collections ?? {}))
    const items = await Promise.all(
      names.map(async (name) => {
        const index = mounted(name)?.collection.index
        const entries = index ? await index(db) : []
        return entries.map((e) => ({ title: e.title, sub: e.sub, href: `/${name}/${encodeURIComponent(e.id)}`, kind: name }))
      }),
    )
    return items.flat()
  },
}

// What the shell around every page reads: the scope, who is signed in,
// everyone the co-op knows by address, so a person shows by name wherever
// a page names them, the circles the co-op selector offers and the one the
// member lensed the co-op on, and how many rows the counted collections
// hold for them, as what waits on them, the owner's and its extensions',
// counted in SQL. `waiting` is every one of them, whole whatever the lens,
// as a shut section's dot reads it; `counts` those in the lensed circle,
// the count the collection's page heads with, as its pill reads it. Signed
// out, it is the scope alone.
export const shell = {
  async run(db: Db, who: Reader) {
    const s = await named(db)
    const someone = who.actor ? await person(db, who.actor) : null
    const lensed = someone ? await lensing(db, who.cookies, someone.address) : { circles: [], lens: null }
    const waiting: Record<string, number> = {}
    const held: Record<string, number> = {}
    for (const name of someone ? counted() : []) {
      const whole = source(name)
      const through = source(name, lensed.lens?.id ?? null)
      waiting[`/${name}`] = whole ? ((await counts(db, whole, [{ where: [] }]))[0] ?? 0) : 0
      held[`/${name}`] = through?.lens ? ((await counts(db, through, [{ where: [] }]))[0] ?? 0) : waiting[`/${name}`]
    }
    return {
      scope: { address: s.address ?? 'no scope', name: s.name ?? s.address ?? 'No scope', legal: s.legal },
      actor: someone && { address: someone.address, name: someone.name },
      people: someone ? Object.fromEntries((await people(db)).map((p) => [p.address, p.name])) : ({} as Record<string, string>),
      counts: held,
      waiting,
      circles: lensed.circles,
      lens: lensed.lens,
    }
  },
}
