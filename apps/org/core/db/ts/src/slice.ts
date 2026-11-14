import type { Pending, Permission, Refused, Settled } from '@cella/org-actions'
import type { Db, Deps } from './index.ts'
import type { Read } from './read.ts'
import type { Query } from './query.ts'

// What one write did, as the shell shows it: the op, its outcome, and its
// effects, the writes that reacted to it in its transaction, such as the
// admissions a passing close carries.
export interface Done {
  op: Permission
  // `failed` is a write that never reached a verdict: no device could sign
  // it, or the handler threw on input it could not take.
  state: 'settled' | 'pending' | 'refused' | 'failed'
  // The log entry a settled write appended, or the one recording an
  // effect forgone.
  entry?: number
  // The last verdict a refusal was judged after.
  verdict?: number
  // The receipt a pending write holds.
  receipt?: number
  reason?: string
  // An effect refused, rolled back to its savepoint and recorded forgone,
  // while the decision it follows stands.
  forgone?: boolean
  then: Done[]
  // The form's fields already written by a write of several that stopped
  // part-way, such as the cells of a week before its first refusal: the
  // form empties them, so trying again sends only the rest.
  spent?: string[]
}

// The effects `write` ran in the transaction of each outcome it returned,
// and the outcomes that are effects forgone, which `done` reads.
export const outcomes = new WeakMap<object, Done[]>()
export const forgone = new WeakSet<object>()

// The handler's outcome, made plain for the page, with its effects.
export function done(op: Permission, outcome: Settled<unknown> | Pending | Refused, then: Done[] = []): Done {
  const effects = [...(outcomes.get(outcome) ?? []), ...then]
  switch (outcome.state) {
    case 'settled':
      return { op, state: 'settled', entry: outcome.entry, then: effects }
    case 'pending':
      return { op, state: 'pending', receipt: outcome.receipt, then: effects }
    case 'refused':
      return forgone.has(outcome)
        ? { op, state: 'refused', entry: outcome.verdict, verdict: outcome.verdict, reason: outcome.reason, forgone: true, then: effects }
        : { op, state: 'refused', verdict: outcome.verdict, reason: outcome.reason, then: effects }
  }
}

// A file a form carries: its name and media type as the browser gave
// them, and its bytes.
export interface Upload {
  name: string
  type: string
  bytes: Uint8Array
}

// A form's fields, as an action reads them, and the files it carries.
export interface Form {
  get(name: string): string
  all(name: string): string[]
  file(name: string): Upload | null
}

// An amount a form types in euros, `1234,56`, `1234.56` or `1 234,56`, in
// whole cents; more than nothing unless `positive` is false, as an
// invoice's line may be.
export function cents(typed: string, positive = true): number {
  const n = Number(typed.replace(/\s/g, '').replace(',', '.'))
  if (!typed.trim() || !Number.isFinite(n) || (positive && n <= 0)) {
    throw new Error(`“${typed}” is not an amount in euros`)
  }
  return Math.round(n * 100)
}

// A percentage a form types, `20`, `5,5` or `2.1`, in whole hundredths of
// a percent, as a signed request holds it: 550 for 5,5 %. Refused below
// nothing or past two decimals.
export function hundredths(typed: string): number {
  const t = typed.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) {
    throw new Error(`“${typed}” is not a percentage with at most two decimals`)
  }
  return Math.round(Number(t) * 100)
}

// A write from a page: the form's fields to the handler's input, through
// the handler. `id` is the item the page shows, if any.
export interface Action {
  op: Permission
  run(form: Form, deps: Deps, id?: string): Promise<{ done: Done; request: unknown }>
}

// An action over one handler: the form read into the handler's input, with
// the page's item and the actor, the handler run as the actor, its outcome
// made plain. The input is read from the database when it needs to be,
// such as a Loro update from the draft it edits.
export function action<I>(
  op: Permission,
  input: (form: Form, id: string | undefined, deps: Deps) => I | Promise<I>,
  handler: (input: I, deps: Deps) => Promise<Settled<unknown> | Pending | Refused>,
): Action {
  return {
    op,
    run: async (form, deps, id) => {
      const request = await input(form, id, deps)
      return { request, done: done(op, await handler(request, deps)) }
    },
  }
}

// An item the command menu can jump to.
export interface Entry {
  id: string
  title: string
  sub?: string
}

// A live stream of an item, served as server-sent events at
// `/<collection>/<id>/<name>`: what changes on the item as it changes,
// such as a document's edits as members make them. `last` is the id of
// the last event the client saw, when it reconnects; `signal` aborts
// when it goes away. A stream reads; writes go through the actions.
export type Stream = (o: {
  using: <T>(fn: (db: Db) => Promise<T>) => Promise<T>
  id: string
  url: URL
  last: string | null
  signal: AbortSignal
}) => ReadableStream<Uint8Array>

// An item's bytes, served at `/<collection>/<id>/content`, such as a
// stored file: its name, media type and bytes, and whether its owner's
// guard lets the acting member open it; where it does not, an extension's
// `allows` may.
export interface Content extends Upload {
  open: boolean
}

// A collection a feat owns: its rows, one item, the items the command menu
// lists, and the writes its pages make. Its rows are a select the shell
// composes with its extensions' and pages in SQL; they may be the acting
// member's, as what waits on them, by `cella.reader()`. A collection that
// only gathers rows from the slices that know each kind has none of its
// own.
export interface Collection {
  list?: Read
  // What the collection's header says about it as a whole, such as
  // whether the log verifies, and what its New form offers, which may be
  // the acting member's, as their week of time.
  about?(db: Db, actor?: string | null): Promise<unknown>
  // An item, given the page's address, as a report is given its span.
  item?(db: Db, id: string, query?: URLSearchParams): Promise<unknown | null>
  index?(db: Db): Promise<Entry[]>
  // Writes from the collection's page, such as a new item, and from an
  // item's page.
  actions?: Record<string, Action>
  // An item's live streams, by name.
  streams?: Record<string, Stream>
  // An item's bytes, for the acting member, or null where there are none.
  content?(db: Db, id: string, actor: string | null): Promise<Content | null>
}

// What a graft, or the root, adds to a collection of a feat it joins:
// fields on each row by its id, data for the item's blocks, and writes.
// An item's data may depend on who looks: `actor` is the acting member's
// address, or null.
export interface Extension {
  // A select of `id` and the fields it adds to the row of that id, which
  // the shell joins to the owner's rows once.
  list?: string
  // Rows it adds to a collection that gathers them from the slices that
  // know each kind, as what waits on the acting member (`cella.reader()`):
  // each its own id.
  rows?: Read
  // What it adds to the collection's `about`, merged over the owner's,
  // such as the circles a new motion may be put in, or the acting
  // member's week of time.
  about?(db: Db, actor?: string | null): Promise<object>
  item?(db: Db, id: string, actor: string | null): Promise<unknown>
  actions?: Record<string, Action>
  // Whether the acting member may open an item's bytes that its owner's
  // guard keeps closed to them, as a power over expenses opens a receipt.
  allows?(db: Db, id: string, actor: string | null): Promise<boolean>
}

// Runs in the transaction of a settled write of the op, after its
// verdict, with its request: a slice's subscription to another slice's
// write, such as carrying out what a passed motion carries. Each write it
// makes is an effect citing the write it follows, which `cella.follows`
// lets follow it.
export type Reaction = (request: unknown, deps: Deps) => Promise<Done[]>

// One record of a file being imported, as a write: the line it was read
// from, what it is, and the write that makes it, as the importing member.
// A line that cannot be read is refused with why, and makes no write.
export interface Imported {
  line: number
  label: string
  op: Permission
  run?: (deps: Deps) => Promise<Settled<unknown> | Pending | Refused>
  refused?: string
}

// A kind of file a slice imports from another tool, such as members from
// a CSV or the books from a FEC: what it is, the formats it reads, and
// each record it reads as a write. `read` throws when the file is not of
// its kind.
export interface Importer {
  title: string
  formats: string
  read(text: string, db: Db): Promise<Imported[]>
}

// A settings page a slice serves at `/settings/<name>`, or, a page of one
// thing, at `/settings/<name>/<id>`: what it reads for the acting person,
// as their own name and devices, of that thing where it is one, none
// where there is none, and the writes that save it, as a collection's
// page makes them, given the thing's id as an item's are.
export interface SettingsPage {
  read(db: Db, actor: string, id?: string): Promise<unknown | null>
  actions?: Record<string, Action>
}

// How an invitation's link, `/join/<secret>`, is taken up: whom it
// invites while they have not taken it up, and the write that takes it
// up, which the invitee's first device signs, the device the browser made
// and posts. The shell serves the link's page and knows no feat; the
// membership feat serves this, and with no slice serving it a link is no
// one's.
export interface Joining {
  op: Permission
  invited(db: Db, secret: string): Promise<{ member: string; name: string } | null>
  accept(input: { member: string; secret: string; key: string; label: string }, deps: Deps): Promise<Settled<unknown> | Pending | Refused>
}

// A slice's server side, which the root mounts: the collections it owns,
// what it adds to the collections of the feats it joins or nests in, its reactions,
// the kinds of file it imports, the settings pages it serves, and how an
// invitation's link is taken up.
export interface Slice {
  // The feat's or graft's name, or `<name>/<part>` for one part of a
  // slice mounted in parts, as a feat a graft of the circles dissolved
  // into keeps what the graft added beside its own: `motion/circles`.
  name: string
  // The feat a nested feat nests in, whose collections it extends as a
  // graft extends those of the feats it joins.
  within?: string
  // A core feat of the app, whose collections any slice may extend,
  // since every feat builds on core: the circles, the people.
  core?: boolean
  collections?: Record<string, Collection>
  extends?: Record<string, Extension>
  on?: Partial<Record<Permission, Reaction>>
  imports?: Record<string, Importer>
  settings?: Record<string, SettingsPage>
  joins?: Joining
  // Its queries written in SQL, by name, each a view of its own schema,
  // which the shell serves as any query.
  queries?: Record<string, Query>
}
