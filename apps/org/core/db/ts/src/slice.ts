import type { Pending, Permission, Refused, Settled } from '@cella/org-ops'
import type { Db, Deps } from './index.ts'

// What one write did, as the shell shows it: the op, its outcome, and the
// writes that reacted to it, such as the admissions a passing close makes.
export interface Done {
  op: Permission
  // `failed` is a write that never reached a verdict: no device could sign
  // it, or the handler threw on input it could not take.
  state: 'settled' | 'pending' | 'refused' | 'failed'
  // The log entry a settled write appended.
  entry?: number
  // The last verdict a refusal was judged after.
  verdict?: number
  // The receipt a pending write holds.
  receipt?: number
  reason?: string
  then: Done[]
}

// The handler's outcome, made plain for the page, and what the reactions
// to it did; `request` is what a reaction to the op reads.
export function done(op: Permission, outcome: Settled<unknown> | Pending | Refused, then: Done[] = []): Done {
  switch (outcome.state) {
    case 'settled':
      return { op, state: 'settled', entry: outcome.entry, then }
    case 'pending':
      return { op, state: 'pending', receipt: outcome.receipt, then }
    case 'refused':
      return { op, state: 'refused', verdict: outcome.verdict, reason: outcome.reason, then }
  }
}

// A form's fields, as an action reads them.
export interface Form {
  get(name: string): string
  all(name: string): string[]
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

// A collection a feat owns: its rows, one item, the items the command menu
// lists, and the writes its pages make.
export interface Collection {
  list(db: Db): Promise<{ id: string }[]>
  // What the collection's header says about it as a whole, such as
  // whether the log verifies.
  about?(db: Db): Promise<unknown>
  item?(db: Db, id: string): Promise<unknown | null>
  index?(db: Db): Promise<Entry[]>
  // Writes from the collection's page, such as a new item, and from an
  // item's page.
  actions?: Record<string, Action>
  // An item's live streams, by name.
  streams?: Record<string, Stream>
}

// What a graft, or the root, adds to a collection of a feat it joins:
// fields on each row by its id, data for the item's blocks, and writes.
// An item's data may depend on who looks: `actor` is the acting member's
// address, or null.
export interface Extension {
  list?(db: Db): Promise<Record<string, object>>
  item?(db: Db, id: string, actor: string | null): Promise<unknown>
  actions?: Record<string, Action>
}

// Runs after a settled write of the op, with its request: a slice's
// subscription to another slice's event, such as admitting the members a
// closed decision admits.
export type Reaction = (request: unknown, deps: Deps) => Promise<Done[]>

// A slice's server side, which the root mounts: the collections it owns,
// what it adds to the collections of the feats it joins, and its reactions.
export interface Slice {
  name: string
  collections?: Record<string, Collection>
  extends?: Record<string, Extension>
  on?: Partial<Record<Permission, Reaction>>
}
