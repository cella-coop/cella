import { VersionVector, type LoroDoc, type PeerID } from 'loro-crdt'
import { ahead, b64, baseOf, holds, type Joined, type Kept, type Merged } from '../models/body.ts'

// What a post comes to: taken, or refused and why. A post that got no
// answer throws.
export type Sent = { ok: true } | { ok: false; reason: string }

// How an editor's browser reaches a record's body: it posts its Loro
// updates to the live session, saves a snapshot through the feat's save
// action, signed by its device, naming the hash of the saved body it
// merged as its `base`, and tells the session it saved, which answers with
// the body the record holds; one that got no answer or was refused
// throws.
export interface Link {
  post(update: Uint8Array): Promise<Sent>
  save(action: string, snapshot: Uint8Array, contributors: string[], base: string): Promise<Sent>
  saved(): Promise<Kept>
}

// The browser's timers, which the tests drive by hand.
export interface Clock {
  set(fn: () => unknown, ms: number): unknown
  clear(timer: unknown): void
}

const real: Clock = { set: (fn, ms) => setTimeout(() => void fn(), ms), clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>) }

export interface Timing {
  clock?: Clock
  // An update is posted this long after an edit, and the body saved this
  // long after the last; a post that got no answer is tried again after
  // `retry`.
  send?: number
  pause?: number
  retry?: number
}

// One editor's browser on a record's body, over its live session. Its
// own edits are posted to the session as one Loro update a quarter
// second after they are made; everyone's arrive on the session's stream
// and are imported. It saves the merged body through the feat's save
// action, signed by its device, after a pause of 3 seconds in its own
// edits and when it leaves, with who contributed since the last save as
// the session tells it; a save with nothing new since the last is not
// made, nor one while it holds an edit the session refused or never had,
// its own or another's, nor one holding only this browser's own version
// of the editor's empty-paragraph seed, which `seeded` names: a record
// merely viewed, never really edited, this browser's seed its only
// commit, is never saved by it.
// Each save names as its `base` the hash of the saved body
// this browser last imported, so the feat refuses one whose snapshot
// does not hold the body it would replace; refused so, the browser reads
// the record's body, merges it and saves at once. A save refused
// otherwise, or failed, says why and is tried again after the next
// pause. A body that rejoins a session the server restarted posts what
// the session lacks, others' edits too, and saves at its pause only once
// the session took it.
export class Live {
  readonly doc: LoroDoc
  readonly #link: Link
  readonly #t: Required<Timing>
  writable = false
  actor = ''
  // Why the session or the save last refused this browser, or that it
  // got no answer.
  problem: string | null = null
  // Whether the last post or save got an answer.
  online = false
  #action = ''
  // What the session is known to hold: its version at the join and,
  // since, every update it relayed, saved or took from this browser.
  #accepted = new VersionVector(null)
  #saved = new VersionVector(null)
  // The hash of the saved body this browser last imported, which its
  // next save names: empty for a body never saved.
  #base = ''
  // Whether a save waits on edits the session has not taken yet.
  #held = false
  #contributors = new Set<string>()
  #sending: Promise<void> | null = null
  #saving: Promise<void> | null = null
  #post: unknown = null
  #pause: unknown = null
  #left = false
  // This browser's own version right after its editor's empty-paragraph
  // seed, or any other local commit whose origin starts `seed`: null
  // until `seeded` names one. A record merely viewed, never edited by
  // anyone, moves no peer's version past its own seed's, so `unsaved`
  // counts nothing held; a real edit, this browser's or one it heard,
  // always does, seed or not.
  #floor: VersionVector | null = null
  // Whether this browser holds a real edit, its own or heard, that no
  // save carries yet: a seed made while one is held never names the
  // floor, so a reseed after a deletion, or after a heard edit, never
  // hides what is held.
  #real = false
  // Called whenever what it shows changes.
  changed: () => void = () => {}

  constructor(doc: LoroDoc, link: Link, t: Timing = {}) {
    this.doc = doc
    this.#link = link
    this.#t = { clock: real, send: 250, pause: 3_000, retry: 2_000, ...t }
  }

  get #own(): number {
    return this.doc.oplogVersion().get(this.doc.peerIdStr) ?? 0
  }

  // Takes what `held` names, each peer's end, into what the session is
  // known to hold.
  #accept(held: Map<PeerID, number>): void {
    const vv = this.#accepted.toJSON()
    for (const [peer, n] of held) {
      vv.set(peer, Math.max(vv.get(peer) ?? 0, n))
    }
    this.#accepted = VersionVector.parseJSON(vv)
  }

  // Whether this browser holds an edit the last save does not: its own
  // or one it heard, but never only the version its own seed moved.
  get unsaved(): boolean {
    return ahead(this.doc, this.#saved) && (this.#real || !this.#floor || ahead(this.doc, this.#floor))
  }

  // This browser made an edit: post it soon, and save at the pause.
  edited(): void {
    if (this.#left) {
      return
    }
    this.#real = true
    const { clock, send, pause } = this.#t
    clock.clear(this.#post)
    this.#post = clock.set(() => this.#flush(), send)
    clock.clear(this.#pause)
    this.#pause = clock.set(() => this.save(), pause)
  }

  // This browser made a commit that changes nothing a reader would see,
  // as the editor's empty-paragraph seed does: names its version the
  // floor `unsaved` reads past. Holding only what this named, `unsaved`
  // reads false; a real edit, from here or heard from another peer,
  // moves the version past it, and `unsaved` reads true again.
  seeded(): void {
    if (!this.#real) {
      this.#floor = this.doc.oplogVersion()
    }
  }

  // A save now carries what it does: a real edit is held only while the
  // body is still past the save and, where a floor is named, past it.
  #settle(): void {
    this.#real = this.#real && ahead(this.doc, this.#saved) && (!this.#floor || ahead(this.doc, this.#floor))
  }

  // The session's `joined`: what this browser may do and saves by, and,
  // where the session lacks edits this browser holds, as after a restart
  // of the server, one post of all of them, its own and others', and a
  // save at the pause, made only once the session took that post.
  async joined(j: Joined): Promise<void> {
    this.writable = j.writable
    this.actor = j.actor
    this.#action = j.save
    this.#base = j.base
    // Rejoining after the same save, as after a restart of the server,
    // this browser keeps who it heard contributed since, edits the new
    // session never saw among them.
    const saved = VersionVector.decode(b64.decode(j.saved))
    this.#contributors = saved.compare(this.#saved) === 0 ? new Set([...this.#contributors, ...j.contributors]) : new Set(j.contributors)
    this.#saved = saved
    this.#settle()
    this.#accepted = VersionVector.decode(b64.decode(j.version))
    this.changed()
    if (!this.writable || !ahead(this.doc, this.#accepted)) {
      return
    }
    await this.#flush()
    this.#later()
  }

  // An update the session relays.
  heard(m: Merged): void {
    const { success } = this.doc.import(b64.decode(m.update))
    if (success.size > 0) {
      this.#real = true
    }
    this.#accept(new Map([...success].map(([peer, span]) => [peer, span.end])))
    for (const c of m.contributors) {
      this.#contributors.add(c)
    }
  }

  // A save the session learned of: its snapshot, which this browser
  // imports, Loro merging it into what it holds, and takes as the base of
  // its next save. Where this browser holds an edit it does not, it saves
  // them at the pause.
  kept(k: Kept): void {
    this.#keep(k)
    if (this.writable && this.unsaved) {
      this.#later()
    }
  }

  #keep(k: Kept): void {
    if (k.snapshot) {
      this.doc.import(b64.decode(k.snapshot))
    }
    this.#base = k.base
    this.#saved = VersionVector.decode(b64.decode(k.saved))
    this.#settle()
    this.#accept(this.#saved.toJSON())
    this.#contributors = new Set(k.contributors)
  }

  // The session dropped this browser, and why: it edits no more.
  dropped(reason: string): void {
    this.writable = false
    this.problem = reason
    this.changed()
  }

  #later(): void {
    const { clock, pause } = this.#t
    clock.clear(this.#pause)
    this.#pause = clock.set(() => this.save(), pause)
  }

  // Every edit this browser holds that the session is not known to, as
  // one update: its own, and after a restart others' it heard before.
  async #flush(): Promise<void> {
    while (this.#sending) {
      await this.#sending
    }
    if (!this.writable || !ahead(this.doc, this.#accepted)) {
      return
    }
    const upto = this.doc.oplogVersion()
    await this.#send(this.doc.export({ mode: 'update', from: this.#accepted }), upto)
  }

  // A post of the edits up to `upto` the session lacks. Taken, a save
  // that waited on them is made at the pause; one that got no answer is
  // tried again.
  async #send(update: Uint8Array, upto: VersionVector): Promise<void> {
    this.#sending = (async () => {
      try {
        const out = await this.#link.post(update)
        this.online = true
        if (out.ok) {
          this.#accept(upto.toJSON())
          if (this.#held && !ahead(this.doc, this.#accepted)) {
            this.#held = false
            this.problem = null
            this.#later()
          }
        } else {
          this.problem = out.reason
        }
      } catch {
        this.online = false
        const { clock, retry } = this.#t
        clock.clear(this.#post)
        this.#post = clock.set(() => this.#flush(), retry)
      }
      this.changed()
    })().finally(() => {
      this.#sending = null
    })
    await this.#sending
  }

  // Saves the merged body now, if this browser holds an edit the last
  // save does not and the session took every edit it holds: those
  // posted first, then the snapshot through the feat's save action,
  // signed by its device, naming its base and who contributed since the
  // last save, this browser's own person among them where it edited; then
  // it tells the session and imports the body the record holds. Refused,
  // it reads that body, and where it is not the one its base names,
  // merges it and saves once more at once. One save at a time.
  async save(): Promise<void> {
    if (this.#saving) {
      return this.#saving
    }
    this.#saving = this.#save().finally(() => {
      this.#saving = null
    })
    return this.#saving
  }

  async #save(): Promise<void> {
    this.#t.clock.clear(this.#pause)
    // Left already, as a stray timer or event calls it late: its own
    // leaving saved what it held then, and this instance edits no more.
    if (this.#left || !this.writable) {
      return
    }
    await this.#flush()
    // No save carries an edit the session refused or never had, this
    // browser's or another's: it waits on them, and the edits are kept.
    if (ahead(this.doc, this.#accepted)) {
      this.#held = true
      this.problem ??= 'edits this browser holds have not reached the body’s session yet: it is saved once they do'
      this.changed()
      return
    }
    const refused = await this.#attempt()
    if (refused === null) {
      return
    }
    try {
      const k = await this.#link.saved()
      if (k.base !== refused.base) {
        this.#keep(k)
        const again = await this.#attempt()
        if (again === null) {
          return
        }
        this.problem = again.reason
        this.changed()
        return
      }
    } catch {
      // The record's body could not be read: the refusal stands.
    }
    this.problem = refused.reason
    this.changed()
  }

  // One save of the body as this browser holds it, from its base: null
  // where it was made, had nothing new or got no answer, else why it was
  // refused and the base it carried, which a `saved` heard meanwhile may
  // have moved on. A browser yet to import the saved body its base
  // names, as between the session's `joined` and its catch-up, saves at
  // the next pause instead.
  async #attempt(): Promise<{ reason: string; base: string } | null> {
    if (!this.unsaved) {
      return null
    }
    if (!holds(this.doc, this.#saved)) {
      this.#later()
      return null
    }
    const version = this.doc.oplogVersion()
    const snapshot = this.doc.export({ mode: 'snapshot' })
    const contributors = new Set(this.#contributors)
    if (this.#own > (this.#saved.get(this.doc.peerIdStr) ?? 0)) {
      contributors.add(this.actor)
    }
    const base = this.#base
    let out: Sent
    try {
      out = await this.#link.save(this.#action, snapshot, [...contributors].sort(), base)
      this.online = true
    } catch {
      this.online = false
      this.problem = 'the save got no answer: it is tried again after your next pause'
      this.changed()
      return null
    }
    if (!out.ok) {
      return { reason: out.reason, base }
    }
    this.problem = null
    this.#saved = version
    this.#settle()
    this.#base = baseOf(snapshot)
    this.#contributors = new Set()
    this.changed()
    await this.#link.saved().then(
      (k) => this.#keep(k),
      () => {},
    )
    return null
  }

  // This browser leaves the body: it saves what it holds that the last
  // save does not, and makes no post after.
  async leave(): Promise<void> {
    const { clock } = this.#t
    clock.clear(this.#post)
    await this.save()
    this.#left = true
    clock.clear(this.#post)
    clock.clear(this.#pause)
  }
}
