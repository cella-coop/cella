import { malformed, type Action, type Collection, type Db, type Deps, type Done, type Extension, type Joining, type Query, type Reaction, type SettingsPage, type Slice, type Source } from '@cella/org-db'
import type { Permission } from '@cella/org-actions'
import { slice as log } from '@cella/org-log/api'
import { slice as person } from '@cella/org-person/api'
import { slice as circle } from '@cella/org-circle/api'
import { slice as circlePolicy } from '@cella/org-graft-circle-policy/api'
import { feats, root } from './feats/index.ts'

// The server sides the shell mounts: core's, the people, the circles, the
// register their policies join and the log, then every slice above core
// (`feats/`), each feat's collections, each graft's extensions of the
// feats it joins and the root's own.
export const slices: Slice[] = [person, circle, circlePolicy, log, ...feats]

export interface Mounted {
  owner: Slice
  collection: Collection
  extensions: { slice: Slice; extension: Extension }[]
}

const collections = new Map<string, Mounted>()
for (const s of slices) {
  for (const [name, collection] of Object.entries(s.collections ?? {})) {
    if (collections.has(name)) {
      throw new Error(`${s.name} and ${collections.get(name)?.owner.name} both own the collection ${name}`)
    }
    collections.set(name, { owner: s, collection, extensions: [] })
  }
}

// A graft extends only the collections of the feats it joins and of the
// feats they nest in, and a nested feat those of the feats it nests in;
// any slice those of core, which every feat builds on, but a core feat
// those of another core feat, which only a core graft joining both
// extends; the root may join any. A slice in parts names each `<slice>/<part>`, and each part
// reaches what its slice does.
const within = new Map(slices.flatMap((s) => (s.within ? [[s.name, s.within] as const] : [])))
const outer = (feat: string): string[] => {
  const up = within.get(feat)
  return up ? [up, ...outer(up)] : []
}
for (const s of slices) {
  for (const [name, extension] of Object.entries(s.extends ?? {})) {
    const mounted = collections.get(name)
    if (!mounted) {
      throw new Error(`${s.name} extends ${name}, which no slice owns`)
    }
    const reach = s.name.split('/')[0].split('-').flatMap((f) => [f, ...outer(f)])
    if (s.core && mounted.owner.core && mounted.owner !== s) {
      throw new Error(`${s.name} extends ${name}, ${mounted.owner.name}'s: no core feat extends another's collections, a core graft joining both does`)
    }
    if (s !== root && !mounted.owner.core && !reach.includes(mounted.owner.name)) {
      throw new Error(`${s.name} extends ${name}, ${mounted.owner.name}'s, which it does not join`)
    }
    for (const write of Object.keys(extension.actions ?? {})) {
      const other = mounted.extensions.find((e) => e.extension.actions?.[write])
      if (other) {
        throw new Error(`${s.name} and ${other.slice.name} both replace ${name}'s write ${write}`)
      }
    }
    mounted.extensions.push({ slice: s, extension })
  }
}

export const mounted = (name: string) => collections.get(name)

// A write the collection's pages offer: an extension's, which replaces
// the owner's of the same name, as a graft that posts an invoice's issue
// replaces the invoice feat's issue; else the owner's.
export function action(name: string, write: string): Action | undefined {
  const m = collections.get(name)
  if (!m) {
    return undefined
  }
  return m.extensions.map((e) => e.extension.actions?.[write]).find((a) => a) ?? m.collection.actions?.[write]
}

// Who judges a write before it is made: the one slice that serves it, the
// membership feat; where none does, every write is judged as it is made.
const judging = slices.filter((s) => s.judges)
if (judging.length > 1) {
  throw new Error(`${judging.map((s) => s.name).join(' and ')} both judge a write before it is made`)
}
const judge = judging[0]?.judges

// Why the reader may not make each write a collection's pages offer on a
// record of `circle`, by the write's name, for those refused alone: every
// write of the collection, its owner's and its extensions', judged in one
// read by the slice that judges them, which asks the guard's own SQL.
export async function refusals(db: Db, name: string, circle: string | null): Promise<Record<string, string>> {
  const m = collections.get(name)
  if (!m || !judge) {
    return {}
  }
  const names = [...new Set([...Object.keys(m.collection.actions ?? {}), ...m.extensions.flatMap((e) => Object.keys(e.extension.actions ?? {}))])]
  const ops = new Map(names.flatMap((n) => {
    const a = action(name, n)
    return a ? [[n, a.op] as const] : []
  }))
  const refused = await judge(db, [...new Set(ops.values())], circle)
  return Object.fromEntries([...ops].flatMap(([n, op]) => (refused[op] ? [[n, refused[op]]] : [])))
}

// Every action name, for the routes' action tables.
export const writes = [
  ...new Set(
    [...collections.values()].flatMap((m) => [
      ...Object.keys(m.collection.actions ?? {}),
      ...m.extensions.flatMap((e) => Object.keys(e.extension.actions ?? {})),
    ]),
  ),
]

// Each collection's form serving a command, by the address the command
// is served at over HTTP, `<feat>/<verb>` of its permission: the
// collection, the write's name and the write its pages run. One address
// names one permission, though several forms may serve it, as a motion's
// proposal is served by each page that offers one.
export interface Command {
  collection: string
  write: string
  action: Action
}

const commanded = new Map<string, Command[]>()
for (const name of collections.keys()) {
  for (const write of writes) {
    const a = action(name, write)
    if (!a) {
      continue
    }
    const [feat, , verb] = a.op.split(':')
    const at = `${feat}/${verb}`
    const other = commanded.get(at)?.find((c) => c.action.op !== a.op)
    if (other) {
      throw new Error(`${a.op} and ${other.action.op} would both be served at POST /api/${at}`)
    }
    commanded.set(at, [...(commanded.get(at) ?? []), { collection: name, write, action: a }])
  }
}

export const commands = (feat: string, verb: string): Command[] => commanded.get(`${feat}/${verb}`) ?? []

// The reactions to a settled op, from every slice.
export const reactions = (op: Permission): Reaction[] => slices.flatMap((s) => s.on?.[op] ?? [])

// Runs the reactions to a settled op, in the transaction of the write
// that settled it, as `write` in `@cella/org-db` asks: a close carries an
// exit and the exit its freeze, each write a reaction makes an effect
// whose own reactions `write` runs in turn, five deep at most.
export async function react(op: Permission, request: unknown, deps: Deps): Promise<Done[]> {
  const out: Done[] = []
  for (const reaction of reactions(op)) {
    out.push(...(await reaction(request, deps)))
  }
  return out
}

// A write's deps with the reactions every slice makes to it.
export const reacting = (deps: Deps): Deps => ({ ...deps, react })

// What a collection's rows are read from: its owner's select, then those
// of the extensions that add rows of their own, and each extension's
// select of the fields it adds to them. `@cella/org-db` composes them
// into one statement, as the acting member reads, and filters, orders and
// pages it there; under the member's lens, `lens`, it keeps only the lensed
// circle's rows, but in the Inbox, which is what waits on the member and
// reads whatever the lens.
export function source(name: string, lens: string | null = null): Source | undefined {
  const m = collections.get(name)
  if (!m) {
    return undefined
  }
  return {
    rows: [m.collection.list, ...m.extensions.map((e) => e.extension.rows)].filter((r) => r !== undefined),
    fields: m.extensions.flatMap((e) => (e.extension.list ? [e.extension.list] : [])),
    lens: name === 'inbox' ? null : lens,
  }
}

// The settings pages the slices serve, by the name in their address, and
// the writes each saves by.
const pages = new Map<string, SettingsPage>()
for (const s of slices) {
  for (const [name, page] of Object.entries(s.settings ?? {})) {
    if (pages.has(name)) {
      throw new Error(`two slices serve the settings page ${name}`)
    }
    pages.set(name, page)
  }
}

export const setting = (name: string) => pages.get(name)

// Every settings page's write name, for the settings route's action table.
export const saves = [...new Set([...pages.values()].flatMap((p) => Object.keys(p.actions ?? {})))]

// How an invitation's link is taken up, from the one slice that serves
// it, the membership feat; none where no slice does, as in a scope of
// core alone, whose every link is no one's.
const joins = slices.filter((s) => s.joins)
if (joins.length > 1) {
  throw new Error(`${joins.map((s) => s.name).join(' and ')} both serve invitations`)
}
export const joining: Joining | undefined = joins[0]?.joins

// The queries the slices write in SQL, by slice and name, each a view of
// its slice's own schema, its names plain (`malformed`), refused as the
// shell starts otherwise.
const queries = new Map<string, Query>()
for (const s of slices) {
  for (const [name, q] of Object.entries(s.queries ?? {})) {
    const wrong = malformed(q, s.name.split('/')[0].replaceAll('-', '_'))
    if (wrong) {
      throw new Error(`${s.name}'s query ${name}: ${wrong}`)
    }
    queries.set(`${s.name}/${name}`, q)
  }
}

export const queried = (slice: string, name: string) => queries.get(`${slice}/${name}`)
