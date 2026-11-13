import { VersionVector, type LoroDoc } from 'loro-crdt'
import { ahead, b64, type Joined, type Kept, type Merged } from '../models/body.ts'

// What a post comes to: taken, or refused and why. A post that got no
// answer throws.
export type Sent = { ok: true } | { ok: false; reason: string }

// How an editor's browser reaches a record's body: it posts its Loro
// updates to the live session, saves a snapshot through the feat's save
// action, signed by its device, and tells the session it saved.
export interface Link {
  post(update: Uint8Array): Promise<Sent>
  save(action: string, snapshot: Uint8Array, contributors: string[]): Promise<Sent>
  saved(): Promise<Sent>
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
// made. A refused or failed save says why and is tried again after the
// next pause. A body that rejoins a session the server restarted posts
// what the session lacks, others' edits too, and saves it at its pause.
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
  #sent = 0
  #saved = new VersionVector(null)
  #contributors = new Set<string>()
  #sending: Promise<void> | null = null
  #saving: Promise<void> | null = null
  #post: unknown = null
  #pause: unknown = null
  #left = false
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

  // Whether this browser holds an edit the last save does not.
  get unsaved(): boolean {
    return ahead(this.doc, this.#saved)
  }

  // This browser made an edit: post it soon, and save at the pause.
  edited(): void {
    if (this.#left) {
      return
    }
    const { clock, send, pause } = this.#t
    clock.clear(this.#post)
    this.#post = clock.set(() => this.#flush(), send)
    clock.clear(this.#pause)
    this.#pause = clock.set(() => this.save(), pause)
  }

  // The session's `joined`: what this browser may do and saves by, and,
  // where the session lacks edits this browser holds, as after a restart
  // of the server, one post of all of them and a save at the pause.
  async joined(j: Joined): Promise<void> {
    this.writable = j.writable
    this.actor = j.actor
    this.#action = j.save
    // Rejoining after the same save, as after a restart of the server,
    // this browser keeps who it heard contributed since, edits the new
    // session never saw among them.
    const saved = VersionVector.decode(b64.decode(j.saved))
    this.#contributors = saved.compare(this.#saved) === 0 ? new Set([...this.#contributors, ...j.contributors]) : new Set(j.contributors)
    this.#saved = saved
    const version = VersionVector.decode(b64.decode(j.version))
    this.#sent = version.get(this.doc.peerIdStr) ?? 0
    this.changed()
    if (!this.writable || !ahead(this.doc, version)) {
      return
    }
    while (this.#sending) {
      await this.#sending
    }
    const upto = this.#own
    await this.#send(this.doc.export({ mode: 'update', from: version }), upto)
    this.#later()
  }

  // An update the session relays.
  heard(m: Merged): void {
    this.doc.import(b64.decode(m.update))
    for (const c of m.contributors) {
      this.#contributors.add(c)
    }
  }

  // A save the session learned of. Where this browser holds an edit it
  // does not, it saves them at the pause.
  kept(k: Kept): void {
    this.#saved = VersionVector.decode(b64.decode(k.saved))
    this.#contributors = new Set(k.contributors)
    if (this.writable && this.unsaved) {
      this.#later()
    }
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

  // This browser's own edits the session does not hold yet, as one update.
  async #flush(): Promise<void> {
    while (this.#sending) {
      await this.#sending
    }
    const upto = this.#own
    if (!this.writable || upto <= this.#sent) {
      return
    }
    const vv = this.doc.oplogVersion().toJSON()
    if (this.#sent) {
      vv.set(this.doc.peerIdStr, this.#sent)
    } else {
      vv.delete(this.doc.peerIdStr)
    }
    await this.#send(this.doc.export({ mode: 'update', from: VersionVector.parseJSON(vv) }), upto)
  }

  async #send(update: Uint8Array, upto: number): Promise<void> {
    this.#sending = (async () => {
      try {
        const out = await this.#link.post(update)
        this.online = true
        if (out.ok) {
          this.#sent = Math.max(this.#sent, upto)
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
  // save does not: its own posted first, then the snapshot through the
  // feat's save action, signed by its device, naming who contributed
  // since the last save, this browser's own person among them where it
  // edited; then it tells the session. One save at a time.
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
    if (!this.writable) {
      return
    }
    await this.#flush()
    if (!this.unsaved) {
      return
    }
    const version = this.doc.oplogVersion()
    const contributors = new Set(this.#contributors)
    if (this.#own > (this.#saved.get(this.doc.peerIdStr) ?? 0)) {
      contributors.add(this.actor)
    }
    let out: Sent
    try {
      out = await this.#link.save(this.#action, this.doc.export({ mode: 'snapshot' }), [...contributors].sort())
      this.online = true
    } catch {
      this.online = false
      this.problem = 'the save got no answer: it is tried again after your next pause'
      this.changed()
      return
    }
    if (!out.ok) {
      this.problem = out.reason
      this.changed()
      return
    }
    this.problem = null
    this.#saved = version
    this.#contributors = new Set()
    this.changed()
    await this.#link.saved().catch(() => {})
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
