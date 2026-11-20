import { ask as asking, counts, made, ordered, read, texts, today, type Condition, type Db } from '@cella/org-db'
import { scoped } from '@cella/org-analytics'
import { anchor, declared, fields, grouping, limits, logged, period, resolve, swimlane, wheres, type Field, type Sort, type Spec } from '@cella/org-ui/models'
import { named } from '@cella/org-log/api'
import type { Named } from '@cella/org-body/models'
import { people, person } from '@cella/org-person/api'
import { lensed, lensing } from '#lib/server/lens.ts'
import { drawn, keeping } from '#lib/server/reads.ts'
import { port } from '#lib/server/analytics.ts'
import { published } from '#lib/server/published.ts'
import { mounted, queried, refusals, slices, source } from '#lib/server/slices.ts'
import { collection as owned, columns, counted, look, views } from '#lib/slices.ts'

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
// rows, group by group where the view groups them, in its sort, else the
// collection's order), in one statement with how many it
// keeps, how many of those hold the text filter, its tabs' counts and
// each enumeration's values (and those of the field the rows are grouped
// by), and those of every other field but a date over the rows the
// view's other conditions keep, where they number at most
// `limits.values`, what Filter offers; the field
// its rows are ordered by first;
// and what its header says about it. A board places every row the view
// keeps, and a calendar those on the days it shows. Under the member's lens it reads only the lensed circle's rows,
// but in a view that reads across circles, and says where the lens
// leaves it whole. `search` is the page's address's query; `scope`, where
// a record's tab lists it, the conditions keeping its rows to those
// naming the record, which every part of the read keeps to.
export const collection = {
  schema: texts(['name', 'search']),
  async run(db: Db, { name, search }: { name: string; search: string }, who: Reader, scope: Condition[] = []) {
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
    const keeps = keeping(spec, fs, looks.then)
    // Its rows through the member's lens, where they have one, but in a
    // view that reads across circles, which reads every circle's rows the
    // member reads.
    const seen = source(name, spec.across ? null : await lensed(db, who.cookies, who.actor)) ?? named
    const from = scope.length ? { ...seen, scope } : seen
    const day = await today(db)
    const paged = spec.layout === 'list' || spec.layout === 'table' || spec.layout === 'gallery'
    // The field a list, a table or a gallery groups its rows by,
    // read group by group in its board's order, and the one a board's
    // columns are, and the one a calendar's cards are coloured by; each
    // answered with all its values, as a board's columns are drawn from
    // them and a calendar's inks handed out by them.
    const by = grouping(spec, fs, looks)
    // The field a board's swimlanes group by, none for a single lane;
    // answered with all its values too, as the lanes are drawn from them.
    const lane = swimlane(spec, fs)
    // A date groups by its month; groups not declared in the look's lanes
    // or a status's lifecycle,
    // months among them, follow the direction of the view's sort.
    const group =
      paged && by
        ? { field: by.key, values: declared(looks, by.key, by.states), ...(by.type === 'date' ? { month: true } : {}), ...(spec.sort ? { dir: spec.sort.dir } : {}) }
        : undefined
    const full = (f: Field) => f.type === 'enum' || ((f === by || f === lane) && f.type !== 'date')
    const { rows, counts, values, groups, whole } = await read(db, from, {
      keep: placing(spec, fs, url, day, looks.then) ?? { ...keeps, ...(group ? { group } : {}) },
      ...(paged ? { limit } : {}),
      counts: [{ where: spec.where }, keeps, ...tabs.map((p) => ({ where: wheres(p.where, fs) }))],
      values: fs.filter(full).map((f) => f.key),
      few: { keys: fs.filter((f) => !full(f) && f.type !== 'date').map((f) => f.key), most: limits.values, keep: keeps },
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
      // How many rows each value of the field the rows are grouped by
      // holds, across every page, a group's header's count.
      groups,
      today: day,
      views: tabs.map((p, i) => ({ ...p, count: tallies[i] ?? 0 })),
      view: id,
      spec,
      look: looks,
      errors,
      // The field the rows are sorted by first and which way: the view's,
      // else the one the collection's read orders by first, which is
      // `declared`, what Order by's default names.
      sorted: spec.sort ? { key: spec.sort.field, dir: spec.sort.dir === 'desc' ? ('descending' as const) : ('ascending' as const) } : ordered(from),
      declared: ordered(from),
      // Whether the lens leaves the collection whole, its rows naming no
      // circle that owns them.
      whole,
    }
  },
}

// A collection as a record's tab lists it: `name`'s rows that name the
// record `id` of the collection `of`, by the column that does, as its
// jump in Related counts them, read as any collection's page is, its view,
// filters and paging in `search`.
export const within = {
  schema: texts(['name', 'search', 'of', 'id']),
  async run(db: Db, { name, search, of, id }: { name: string; search: string; of: string; id: string }, who: Reader) {
    const key = naming(name, of)
    if (!key) {
      throw new Missing(`No row of ${name} names a record of ${of}`)
    }
    return collection.run(db, { name, search }, who, [{ field: key, is: [id] }])
  },
}

// In a calendar, the rows the view keeps on the days it shows: the month
// or week around the day the address is at, else today's, by the date it
// places them by, the first when the view names none.
function placing(spec: Spec, fs: Field[], url: URLSearchParams, today: string, then?: Sort) {
  const on = fs.find((f) => f.key === spec.on) ?? fs.find((f) => f.type === 'date')
  if (spec.layout !== 'calendar' || !on) {
    return undefined
  }
  const { days } = period(anchor(url.get('at'), today), spec.span, today)
  return { ...keeping(spec, fs, then), where: [...spec.where, { field: on.key, from: days[0]?.day ?? today, to: days.at(-1)?.day ?? today }] }
}

// An item: its owner's data, given the address, and each extension's data
// on it, by slice, with who looks, for a block that offers what only the
// viewer may do, and when and by whom it was created and last updated, as
// the log has it, once the reader has read it. Of another circle's, it is
// none to the reader.
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
    // One after another: `db` is one connection, which runs one query at
    // a time, so reading them at once would only queue them on it.
    const added: (readonly [string, unknown])[] = []
    for (const e of m.extensions.filter((e) => e.extension.item)) {
      added.push([e.slice.name, await e.extension.item?.(db, id, who.actor)] as const)
    }
    const viewer = who.session && { actor: who.session.actor, device: who.session.device }
    return {
      name,
      id,
      item: found,
      added: Object.fromEntries(added),
      viewer,
      // Why the reader may not make each write the page offers, by its
      // name, judged before they make it: a form that is its one button
      // draws itself unavailable, saying why.
      refused: who.actor ? await refusals(db, name, await owning(db, name, id, found)) : {},
      made: (await made(db, [id]))[id] ?? null,
      jumps: await jumps(db, name, id, who),
    }
  },
}

// Whom a mention of an item may name, by the collection and the record:
// edit-time data for the comment box's mention picker, read by the
// browser only once the box mounts, never with the item at SSR.
export const readers = {
  schema: texts(['name', 'id']),
  async run(db: Db, { name, id }: { name: string; id: string }, who: Reader): Promise<Named[]> {
    const m = mounted(name)
    const fn = m?.collection.readers
    if (!m || !fn) {
      throw new Missing(`There is no collection ${name} with readers`)
    }
    return (await fn(db, id, who.actor)) as Named[]
  },
}

// The column of collection `from` whose value names a record of
// `collection`: the first that says it is `of` it, else the first holding
// a person's address for `people` or a circle's id for `circles`; never
// one the log adds, who created or last updated the row.
const naming = (from: string, collection: string): string | undefined => {
  const own = columns(from).filter((c) => !logged.includes(c))
  const kind = collection === 'people' ? 'person' : collection === 'circles' ? 'circle' : undefined
  return (own.find((c) => c.of === collection) ?? own.find((c) => kind && c.kind === kind))?.key
}

// Where a record's page jumps to, the drawer's Related: every other
// collection whose rows name it, by the column that does, with how many
// of them the reader sees through their lens, as that collection's page
// filtered to the record shows them, each counted in the core read's one
// statement; a collection holding none is no jump, nor one of home or
// Settings, what waits on the reader and their own.
async function jumps(db: Db, name: string, id: string, who: Reader) {
  const lens = await lensed(db, who.cookies, who.actor)
  // One count after another, on `db`'s one connection, as above.
  const found: { collection: string; count: number; href: string }[] = []
  for (const c of slices.flatMap((s) => Object.keys(s.collections ?? {})).filter((c) => c !== name && !owned(c)?.view.group)) {
    const key = naming(c, name)
    const from = key ? source(c, lens) : undefined
    if (!key || !from) {
      continue
    }
    const where = [{ field: key, is: [id] }]
    const [count = 0] = await counts(db, from, [{ where }])
    if (count) {
      found.push({ collection: c, count, href: `/${c}?${new URLSearchParams({ where: JSON.stringify(where) })}` })
    }
  }
  return found
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
// everyone the coop knows by address, so a person shows by name wherever
// a page names them, the circles the coop selector offers, each with its
// features, which the sidebar draws for the circle the member is in, and
// the one the member lensed the coop on, and how many rows the counted collections
// hold for them, as what waits on them, the owner's and its extensions',
// counted in SQL. `waiting` is every one of them, whole whatever the lens,
// as a shut accordion's dot reads it; `counts` those in the lensed circle,
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
      scope: { address: s.address ?? 'no scope', name: s.name ?? s.address ?? 'No scope', legal: s.legal, logo: s.logo },
      actor: someone && { address: someone.address, name: someone.name },
      people: someone ? Object.fromEntries((await people(db)).map((p) => [p.address, p.name])) : ({} as Record<string, string>),
      counts: held,
      waiting,
      circles: lensed.circles,
      lens: lensed.lens,
    }
  },
}

// A query a slice writes in SQL, by the slice and its name, its own
// argument given as an address's query string (`search`), which the
// query's schema validates: its rows as the reader reads them through its
// view. One no slice declares is none. One the slice publishes in its
// analytical contract reads as its owner, so it is read through the
// analytics port as a report of its one view for the
// reader of `db`: the rows of a scoped view whose circles they read it in
// and their own, the cells of a counted view open books shares with them.
export const ask = {
  schema: texts(['slice', 'name', 'search']),
  async run(db: Db, { slice, name, search }: { slice: string; name: string; search: string }) {
    const q = queried(slice, name)
    if (!q) {
      throw new Missing(`${slice} has no query ${name}`)
    }
    const arg = Object.fromEntries(new URLSearchParams(search))
    return q.published ? published(scoped(port, db), q, arg) : asking(db, q, arg)
  },
}

// The circle that owns a record, which the writes on it name: the one its
// item names, else the one its row in the collection's list names, or
// none, where neither names one, which asks whether the reader holds a
// power at all.
async function owning(db: Db, name: string, id: string, item: unknown): Promise<string | null> {
  const named = (row: unknown) => {
    const c = (Object(row) as { circle?: unknown }).circle
    return typeof c === 'string' ? c : null
  }
  const own = named(item)
  const from = source(name)
  if (own || !from) {
    return own
  }
  const [row] = (await read(db, from, { keep: { where: [{ field: 'id', is: [id] }] }, limit: 1 })).rows
  return named(row)
}
