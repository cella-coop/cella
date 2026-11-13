import type { Db } from '@cella/org-db'
import type { VersionVector } from 'loro-crdt'
import { createDoc } from '../models/blocks.ts'
import { canonical } from '../models/canonical.ts'
import { since, type LoroDoc } from '../models/body.ts'

// What a feat that keeps bodies hands the session when its `./api`
// mounts: the collection its records are served under, how to read a
// record's owning circle and its saved body, each as the reader of `db`
// sees them, null where they see no such record or no body yet, and the
// name of its save write, which an editor's browser sends its save as,
// signed by its device.
export interface Mount {
  kind: string
  circle(db: Db, record: string): Promise<string | null>
  saved(db: Db, record: string): Promise<Uint8Array | null>
  save: string
}

// A connection reading for `actor`, as the shell lends one.
export type Using = <T>(actor: string | null, fn: (db: Db) => Promise<T>) => Promise<T>

// What the shell hands the session when it starts it: its connections,
// and whether a person holds a power over a record of a circle
// (membership's `may`, on the verdict date).
export interface Options {
  using: Using
  may(db: Db, actor: string, power: string, circle: string): Promise<boolean>
}

// What a peer hears: an update merged, from any peer, a save made, each
// with who contributed since the last save, or that it is dropped and why.
export type Heard =
  | { type: 'update'; update: Uint8Array; contributors: string[] }
  | { type: 'saved'; saved: Uint8Array; contributors: string[] }
  | { type: 'dropped'; reason: string }

// What a post to the session comes to: an update merged, a save taken
// note of, or why not.
export type Posted = { state: 'merged' } | { state: 'saved' } | { state: 'refused'; reason: string }

// What a peer is handed as it joins: its place, the update holding all
// it lacks, and what its browser needs to save.
export interface Opened {
  peer: Peer
  update: Uint8Array
  save: string
  version: Uint8Array
  saved: Uint8Array
  contributors: string[]
}

// The power editing a body needs, in the record's circle.
export const power = 'discuss'

const key = (kind: string, record: string) => `${kind}/${record}`

const unread = 'this record is no longer one you read'

// One editor's place in a body's session: whether it may edit, what it
// lacks to catch up, and what it hears from here on.
export class Peer {
  readonly actor: string
  writable: boolean
  #hear: ((h: Heard) => void) | null = null
  #heard: Heard[] = []
  readonly #leave: (p: Peer) => void

  constructor(actor: string, writable: boolean, leave: (p: Peer) => void) {
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

  leave(): void {
    this.#leave(this)
  }
}

// One open body: the server's own peer, its document, the version vector
// of the snapshot last saved, whose Loro peer each editor's browser is,
// and who has it open.
class Open {
  readonly mount: Mount
  readonly record: string
  readonly doc: LoroDoc
  saved: VersionVector
  authors = new Map<string, string>()
  peers = new Set<Peer>()

  constructor(mount: Mount, record: string, doc: LoroDoc) {
    this.mount = mount
    this.record = record
    this.doc = doc
    this.saved = doc.oplogVersion()
  }

  // Who contributed since the last save: the editors whose browsers' Loro
  // peers hold edits the saved snapshot does not, by address, sorted.
  contributors(): string[] {
    const out = new Set<string>()
    for (const [peer, n] of this.doc.oplogVersion().toJSON()) {
      const author = this.authors.get(peer)
      if (author && n > (this.saved.get(peer) ?? 0)) {
        out.add(author)
      }
    }
    return [...out].sort()
  }
}

// The live session of every open body. The server joins each body an
// editor opens as one more Loro peer, in memory: it merges what each
// editor posts and relays it to all who have it open, with who
// contributed since the last save. It saves nothing: each editor's
// browser saves through its feat's action, signed by its device, and
// tells the session, which reads what the record holds now. It knows no
// feat.
export class Session {
  readonly #o: Options
  readonly #mounts = new Map<string, Mount>()
  readonly #open = new Map<string, Open>()
  readonly #opening = new Map<string, Promise<Open>>()

  constructor(o: Options) {
    this.#o = o
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
  // circle, the update holding all they lack by the Loro version vector
  // they sent, and what their browser saves by. `loro` is their browser's
  // Loro peer, whose edits the session names them for from here on; the
  // first to claim a Loro peer keeps it. The first to open the body
  // starts the session from the saved snapshot.
  async join(kind: string, record: string, actor: string, vv?: string | null, loro?: string | null): Promise<Opened | null> {
    const m = this.#mounted(kind)
    const asked = await this.#ask(m, record, actor)
    if (!asked) {
      return null
    }
    const body = await this.#start(m, record, actor)
    if (loro && /^\d+$/.test(loro) && !body.authors.has(loro)) {
      body.authors.set(loro, actor)
    }
    const peer = new Peer(actor, asked.may, (p) => this.#gone(body, p))
    body.peers.add(peer)
    return {
      peer,
      update: since(body.doc, vv),
      save: m.save,
      version: body.doc.oplogVersion().encode(),
      saved: body.saved.encode(),
      contributors: body.contributors(),
    }
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
        this.#open.set(k, body)
        return body
      })().finally(() => this.#opening.delete(k))
      this.#opening.set(k, opening)
    }
    return opening
  }

  // The open body and `actor`'s peers on it, or why they post nothing.
  #theirs(kind: string, record: string, actor: string): { body: Open; mine: Peer[] } | string {
    const body = this.#open.get(key(kind, record))
    const mine = body ? [...body.peers].filter((p) => p.actor === actor) : []
    return body && mine.length ? { body, mine } : 'this body is not open here: open it again to edit it'
  }

  // An update `actor` posts to a body they have open. They are asked
  // again first: one who no longer may discuss it is refused, and every
  // peer of theirs on it dropped, so a mandate revoked mid-session ends
  // their editing at their next keystroke. Bytes that are not a Loro
  // update, or leave the body with no canonical form, are refused. A
  // merged update is relayed to every peer, the poster's own too, which
  // Loro imports once.
  async post(kind: string, record: string, actor: string, update: Uint8Array): Promise<Posted> {
    const m = this.#mounted(kind)
    const theirs = this.#theirs(kind, record, actor)
    if (typeof theirs === 'string') {
      return { state: 'refused', reason: theirs }
    }
    const { body, mine } = theirs
    const asked = await this.#ask(m, record, actor)
    if (!asked?.may) {
      const reason = asked
        ? `editing this body needs ${power} in ${asked.circle}, which you no longer hold: a mandate granting it there would let you edit again`
        : unread
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
    const contributors = body.contributors()
    for (const p of body.peers) {
      p.tell({ type: 'update', update, contributors })
    }
    return { state: 'merged' }
  }

  // `actor`'s browser saved the body through its feat's action. The
  // session reads the snapshot the record holds now, as `actor` reads
  // it, merges it in and counts from it who contributed since; it asks
  // every peer again, dropping a writable one that may no longer discuss
  // the body and any that no longer reads it, and tells the rest. What
  // the record holds is the save, whoever's landed last.
  async saved(kind: string, record: string, actor: string): Promise<Posted> {
    const m = this.#mounted(kind)
    const theirs = this.#theirs(kind, record, actor)
    if (typeof theirs === 'string') {
      return { state: 'refused', reason: theirs }
    }
    const { body } = theirs
    const snapshot = await this.#o.using(actor, (db) => m.saved(db, record))
    if (!snapshot) {
      return { state: 'refused', reason: 'the record holds no saved body' }
    }
    const kept = createDoc()
    try {
      kept.import(snapshot)
    } catch (e) {
      return { state: 'refused', reason: `the record's body is not a Loro snapshot: ${(e as Error).message}` }
    }
    body.doc.import(snapshot)
    body.saved = kept.oplogVersion()
    for (const who of new Set([...body.peers].map((p) => p.actor))) {
      const asked = await this.#ask(m, record, who)
      for (const p of [...body.peers].filter((p) => p.actor === who)) {
        if (!asked) {
          this.#drop(body, p, unread)
        } else if (p.writable && !asked.may) {
          this.#drop(body, p, `editing this body needs ${power} in ${asked.circle}, which you no longer hold`)
        }
      }
    }
    const heard = { type: 'saved' as const, saved: body.saved.encode(), contributors: body.contributors() }
    for (const p of body.peers) {
      p.tell(heard)
    }
    return { state: 'saved' }
  }

  #drop(body: Open, peer: Peer, reason: string): void {
    body.peers.delete(peer)
    peer.tell({ type: 'dropped', reason })
  }

  // The last to leave closes the body: the next to open it starts again
  // from what the record holds.
  #gone(body: Open, peer: Peer): void {
    body.peers.delete(peer)
    const k = key(body.mount.kind, body.record)
    if (!body.peers.size && this.#open.get(k) === body) {
      this.#open.delete(k)
    }
  }

  // Who has a body open, by address, once each.
  editors(kind: string, record: string): string[] {
    return [...new Set([...(this.#open.get(key(kind, record))?.peers ?? [])].map((p) => p.actor))].sort()
  }
}
