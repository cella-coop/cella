import type { Pending, Refused, Settled } from '@cella/org-actions'
import type { Db, Deps } from '@cella/org-db'
import { createDoc } from '../models/blocks.ts'
import { canonical } from '../models/canonical.ts'
import { since, type LoroDoc } from '../models/body.ts'
import { memory, type Buffer, type Held } from './buffer.ts'

// What a save carries: the record, the merged body as a Loro snapshot,
// and the addresses of who contributed since the last save, sorted.
export interface Save {
  record: string
  snapshot: Uint8Array
  contributors: string[]
}

export type Saved = Settled<unknown> | Pending | Refused

// What a feat that keeps bodies hands the session when its `./api`
// mounts: the collection its records are served under, how to read a
// record's owning circle and its saved body, each as the reader of `db`
// sees them, null where they see no such record or no body yet, and its
// save action, run with the scope's own deps.
export interface Mount {
  kind: string
  circle(db: Db, record: string): Promise<string | null>
  saved(db: Db, record: string): Promise<Uint8Array | null>
  save(input: Save, deps: Deps): Promise<Saved>
}

// A connection reading for `actor`, as the shell lends one.
export type Using = <T>(actor: string | null, fn: (db: Db) => Promise<T>) => Promise<T>

// The session's timers, which the tests drive by hand.
export interface Clock {
  set(fn: () => void, ms: number): unknown
  clear(timer: unknown): void
}

const real: Clock = { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>) }

// What the shell hands the session when it starts it: its connections,
// whether a person holds a power over a record of a circle (membership's
// `may`, on the verdict date), the scope's own deps, which a save is
// signed with, and where the updates since a save are kept.
export interface Options {
  using: Using
  may(db: Db, actor: string, power: string, circle: string): Promise<boolean>
  scope(): Deps | Promise<Deps>
  buffer?: Buffer
  clock?: Clock
  // A save after this long with no edit, and at most this long after the
  // first edit it carries.
  pause?: number
  every?: number
}

// What a peer hears: an update merged, from any peer, or that it is
// dropped and why.
export type Heard = { type: 'update'; update: Uint8Array } | { type: 'dropped'; reason: string }

// What a post of an update comes to.
export type Posted = { state: 'merged' } | { state: 'refused'; reason: string }

// The power editing a body needs, in the record's circle.
export const power = 'discuss'

const key = (kind: string, record: string) => `${kind}/${record}`

// One editor's place in a body's session: whether it may edit, what it
// lacks to catch up, and what it hears from here on.
export class Peer {
  readonly actor: string
  writable: boolean
  #hear: ((h: Heard) => void) | null = null
  #heard: Heard[] = []
  readonly #leave: (p: Peer) => Promise<void>

  constructor(actor: string, writable: boolean, leave: (p: Peer) => Promise<void>) {
    this.actor = actor
    this.writable = writable
    this.#leave = leave
  }

  // What this peer hears; what it heard before it listened comes first.
  listen(hear: (h: Heard) => void): void {
    this.#hear = hear
    for (const h of this.#heard.splice(0)) {
      hear(h)
    }
  }

  tell(h: Heard): void {
    if (this.#hear) {
      this.#hear(h)
    } else {
      this.#heard.push(h)
    }
  }

  leave(): Promise<void> {
    return this.#leave(this)
  }
}

// One open body: the server's own peer, its document, the base it was
// last saved at, the updates merged since, and who has it open.
class Open {
  readonly mount: Mount
  readonly record: string
  readonly doc: LoroDoc
  base: Uint8Array
  updates: Held[] = []
  peers = new Set<Peer>()
  pause: unknown = null
  every: unknown = null
  saving: Promise<void> | null = null
  problem: string | null = null

  constructor(mount: Mount, record: string, doc: LoroDoc) {
    this.mount = mount
    this.record = record
    this.doc = doc
    this.base = doc.export({ mode: 'snapshot' })
  }
}

// The live session of every open body. The server joins each body an
// editor opens as one more Loro peer, in memory: it merges what each
// editor posts, relays it to all who have it open, and saves the merged
// body through the save its feat handed it. It knows no feat.
export class Session {
  readonly #o: Required<Omit<Options, 'buffer' | 'clock'>> & { buffer: Buffer; clock: Clock }
  readonly #mounts = new Map<string, Mount>()
  readonly #open = new Map<string, Open>()
  readonly #opening = new Map<string, Promise<Open>>()

  constructor(o: Options) {
    this.#o = { pause: 3_000, every: 30_000, buffer: memory(), clock: real, ...o }
  }

  // A feat's bodies, as its `./api` mounts them.
  mount(m: Mount): void {
    this.#mounts.set(m.kind, m)
  }

  // Whether a feat mounted bodies of `kind`.
  keeps(kind: string): boolean {
    return this.#mounts.has(kind)
  }

  #mounted(kind: string): Mount {
    const m = this.#mounts.get(kind)
    if (!m) {
      throw new Error(`${kind} keeps no body: no feat mounted one`)
    }
    return m
  }

  // Whether `actor` reads the record, and may discuss it in its circle,
  // asked anew each time.
  async #ask(m: Mount, record: string, actor: string): Promise<{ circle: string; may: boolean } | null> {
    return this.#o.using(actor, async (db) => {
      const circle = await m.circle(db, record)
      return circle === null ? null : { circle, may: await this.#o.may(db, actor, power, circle) }
    })
  }

  // Opens a record's body for `actor`: null where they read no such
  // record, else their peer, writable where they may discuss it in its
  // circle, and the update holding all they lack by the Loro version
  // vector they sent. The first to open it starts the session from the
  // saved snapshot.
  async join(kind: string, record: string, actor: string, vv?: string | null): Promise<{ peer: Peer; update: Uint8Array } | null> {
    const m = this.#mounted(kind)
    const asked = await this.#ask(m, record, actor)
    if (!asked) {
      return null
    }
    const body = await this.#start(m, record, actor)
    const peer = new Peer(actor, asked.may, (p) => this.#gone(body, p))
    body.peers.add(peer)
    return { peer, update: since(body.doc, vv) }
  }

  async #start(m: Mount, record: string, actor: string): Promise<Open> {
    const k = key(m.kind, record)
    const open = this.#open.get(k)
    if (open) {
      return open
    }
    let opening = this.#opening.get(k)
    if (!opening) {
      opening = (async () => {
        const saved = await this.#o.using(actor, (db) => m.saved(db, record))
        const doc = createDoc()
        if (saved) {
          doc.import(saved)
        }
        const body = new Open(m, record, doc)
        // Updates the buffer still holds, of a restart whose save
        // failed, are merged in and carried by the next save.
        const kept = this.#o.buffer.held().find((b) => b.key === k)
        if (kept?.updates.length) {
          doc.import(kept.base)
          doc.importBatch(kept.updates.map((u) => u.update))
          body.base = kept.base
          body.updates = kept.updates
          this.#schedule(body)
        }
        this.#open.set(k, body)
        return body
      })().finally(() => this.#opening.delete(k))
      this.#opening.set(k, opening)
    }
    return opening
  }

  // An update `actor` posts to a body they have open. They are asked
  // again first: one who no longer may discuss it is refused, and every
  // peer of theirs on it dropped, so a mandate revoked mid-session ends
  // their editing at their next keystroke. Bytes that are not a Loro
  // update, or leave the body with no canonical form, are refused. A
  // merged update is kept in the buffer and relayed to every peer, the
  // poster's own too, which Loro imports once.
  async post(kind: string, record: string, actor: string, update: Uint8Array): Promise<Posted> {
    const m = this.#mounted(kind)
    const body = this.#open.get(key(kind, record))
    const mine = body ? [...body.peers].filter((p) => p.actor === actor) : []
    if (!body || !mine.length) {
      return { state: 'refused', reason: 'this body is not open here: open it again to edit it' }
    }
    const asked = await this.#ask(m, record, actor)
    if (!asked?.may) {
      const reason = asked
        ? `editing this body needs ${power} in ${asked.circle}, which you no longer hold: a mandate granting it there would let you edit again`
        : 'this record is no longer one you read'
      for (const p of mine) {
        this.#drop(body, p, reason)
      }
      return { state: 'refused', reason }
    }
    const fork = body.doc.fork()
    try {
      fork.import(update)
      canonical(fork)
    } catch (e) {
      return { state: 'refused', reason: `the update is not one this body takes: ${(e as Error).message}` }
    }
    body.doc.import(update)
    const held = { author: actor, update }
    body.updates.push(held)
    this.#o.buffer.append(key(kind, record), body.base, held)
    for (const p of body.peers) {
      p.tell({ type: 'update', update })
    }
    this.#schedule(body)
    return { state: 'merged' }
  }

  #drop(body: Open, peer: Peer, reason: string): void {
    body.peers.delete(peer)
    peer.tell({ type: 'dropped', reason })
  }

  // A save after a pause in the edits, and at most `every` after the
  // first edit since the last.
  #schedule(body: Open): void {
    const { clock, pause, every } = this.#o
    // A timer's save that throws, as on a lost connection, says why and
    // keeps its updates for the next edit's, never failing the server.
    const save = () =>
      void this.save(body.mount.kind, body.record).catch((e: Error) => {
        body.problem = e.message
      })
    clock.clear(body.pause)
    body.pause = clock.set(save, pause)
    body.every ??= clock.set(save, every)
  }

  async #gone(body: Open, peer: Peer): Promise<void> {
    body.peers.delete(peer)
    if (!body.peers.size) {
      await this.save(body.mount.kind, body.record).catch((e: Error) => {
        body.problem = e.message
      })
      // A body whose save failed stays open, its updates with it, so the
      // next to open it carries on from them and its next save takes them.
      if (!body.peers.size && !body.updates.length && this.#open.get(key(body.mount.kind, body.record)) === body) {
        this.#open.delete(key(body.mount.kind, body.record))
      }
    }
  }

  // Saves a body now, if anything was merged since its last save. Every
  // peer is asked again first: a writable one that no longer may discuss
  // it, or one that no longer reads it, is dropped. A save is one at a
  // time; one asked for while another runs follows it.
  async save(kind: string, record: string): Promise<void> {
    const body = this.#open.get(key(kind, record))
    if (!body) {
      return
    }
    while (body.saving) {
      await body.saving
    }
    if (!body.updates.length) {
      return
    }
    body.saving = this.#saving(body).finally(() => {
      body.saving = null
    })
    await body.saving
  }

  async #saving(body: Open): Promise<void> {
    const { clock } = this.#o
    clock.clear(body.pause)
    clock.clear(body.every)
    body.pause = body.every = null
    const actors = new Set([...body.peers].map((p) => p.actor))
    for (const actor of actors) {
      const asked = await this.#ask(body.mount, body.record, actor)
      for (const p of [...body.peers].filter((p) => p.actor === actor)) {
        if (!asked) {
          this.#drop(body, p, 'this record is no longer one you read')
        } else if (p.writable && !asked.may) {
          this.#drop(body, p, `editing this body needs ${power} in ${asked.circle}, which you no longer hold`)
        }
      }
    }
    const n = body.updates.length
    const snapshot = body.doc.export({ mode: 'snapshot' })
    const contributors = [...new Set(body.updates.slice(0, n).map((u) => u.author))].sort()
    // A save that throws is kept for the next, as a refused one is.
    let out: Saved
    try {
      out = await body.mount.save({ record: body.record, snapshot, contributors }, await this.#o.scope())
    } catch (e) {
      out = { state: 'refused', verdict: 0, reason: (e as Error).message }
    }
    if (out.state === 'refused') {
      body.problem = out.reason
      if (body.updates.length) {
        this.#schedule(body)
      }
      return
    }
    body.problem = null
    body.base = snapshot
    body.updates = body.updates.slice(n)
    const k = key(body.mount.kind, body.record)
    this.#o.buffer.clear(k)
    for (const held of body.updates) {
      this.#o.buffer.append(k, body.base, held)
    }
    if (body.updates.length) {
      this.#schedule(body)
    }
  }

  // Why a body's last save failed, or null.
  problem(kind: string, record: string): string | null {
    return this.#open.get(key(kind, record))?.problem ?? null
  }

  // Who has a body open, by address, once each.
  editors(kind: string, record: string): string[] {
    return [...new Set([...(this.#open.get(key(kind, record))?.peers ?? [])].map((p) => p.actor))].sort()
  }

  // At a restart: each body the buffer holds updates of, of a kind
  // mounted, merged over the base it holds and saved at once, its
  // contributors the updates' authors. How many it saved.
  async recover(): Promise<number> {
    let saved = 0
    for (const kept of this.#o.buffer.held()) {
      const slash = kept.key.indexOf('/')
      const m = this.#mounts.get(kept.key.slice(0, slash))
      if (!m || !kept.updates.length) {
        continue
      }
      const doc = createDoc()
      doc.import(kept.base)
      doc.importBatch(kept.updates.map((u) => u.update))
      const record = kept.key.slice(slash + 1)
      const contributors = [...new Set(kept.updates.map((u) => u.author))].sort()
      const out = await m.save({ record, snapshot: doc.export({ mode: 'snapshot' }), contributors }, await this.#o.scope())
      if (out.state !== 'refused') {
        this.#o.buffer.clear(kept.key)
        saved++
      }
    }
    return saved
  }
}
