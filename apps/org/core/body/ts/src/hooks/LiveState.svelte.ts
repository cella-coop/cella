import { took, type Answer } from '@cella/org-ui'
import type { LoroDoc } from 'loro-crdt'
import { hash } from '../models/canonical.ts'
import { b64, type Joined, type Kept, type Merged } from '../models/body.ts'
import { Live, type Link, type Sent } from './live.ts'

const retry = 2000

// Where a record's body lives, as the slice that mounts it says: the URL
// of its live session, and the write that saves it, sent by the page's
// `send` and signed as any write is, its snapshot in the `snapshot`
// field, the hash of the saved body it merged in `base`, and one
// `contributor` field an address. `who` names who keeps a draft of this
// body in this browser: the signed-in person and, on a demo, the copy's
// own join code, fresh on every copy and on every reset of one, so a
// draft never replays for the wrong person or into a copy a reset has
// moved past.
export interface Seat {
  live: () => string
  save: (write: string, fields: [string, string][]) => Promise<Answer>
  who: () => string
}

// A day: a draft older than this is never replayed, only dropped.
const day = 24 * 60 * 60 * 1000

// A write's answer, as `Live` reads it.
const sent = (a: Answer): Sent => {
  if (took(a)) {
    return { ok: true }
  }
  if ('done' in a) {
    return { ok: false, reason: a.done?.reason ?? `the save was refused (${a.status})` }
  }
  throw new Error('not taken')
}

// The post telling the session this browser saved, answered with the body
// the record holds; one refused or with no answer it can read throws.
// `keepalive` lets the browser finish it past a document it is leaving,
// where an abort does not cut it off first.
async function kept(url: string, signal: AbortSignal): Promise<Kept> {
  const body = new FormData()
  body.append('saved', '1')
  const res = await fetch(url, { method: 'POST', body, headers: { accept: 'application/json' }, signal, keepalive: true })
  const r = (await res.json()) as { type: string; data?: Kept & { done?: { reason?: string } } }
  if (r.type !== 'success' || !r.data) {
    throw new Error(r.data?.done?.reason ?? `refused (${res.status})`)
  }
  return r.data
}

// A post to the live session, answered as a form's is. One with no
// answer it can read throws, which reads as being offline. `keepalive`
// lets it finish past a document it is leaving, as `kept`'s does, where
// it fits the browser's keepalive budget (64 KiB for all in flight); a
// larger one, a long paste or a catch-up, posts as any other fetch.
const KEEPALIVE = 48 * 1024
async function told(url: string, fields: [string, string][], signal: AbortSignal): Promise<Sent> {
  const size = fields.reduce((n, [k, v]) => n + k.length + v.length, 0)
  const body = new FormData()
  for (const [k, v] of fields) {
    body.append(k, v)
  }
  const res = await fetch(url, { method: 'POST', body, headers: { accept: 'application/json' }, signal, keepalive: size < KEEPALIVE })
  if (res.status === 401) {
    return { ok: false, reason: 'sign in first' }
  }
  const r = (await res.json()) as { type: string; data?: { done?: { reason?: string } } }
  return r.type === 'success' ? { ok: true } : { ok: false, reason: r.data?.done?.reason ?? `refused (${res.status})` }
}

// A record's body kept live in the browser over its session: its updates
// posted to the session's address, and its saves sent as the feat's save
// write, each signed by this browser's device as every write is. It
// saves at a pause in a real edit of its own and when it leaves the
// body, the page's unmounting, the tab's hiding or a page left for
// another document; the stream reopens with this browser's version
// vector, so it misses nothing. The editor's empty-paragraph seed, and
// any normalisation that changes nothing a reader would see, is never a
// real edit, so a record merely viewed, never edited, is never saved.
// Leaving the page for another document aborts the session's posts in
// flight where this browser holds no real edit, since a request the
// browser would otherwise cut off as the document goes saves nothing,
// and WebKit reports it as the page's error; an abort sets no problem
// the body shows. Where it does hold one, it is saved instead of
// abandoned: the session's own posts are asked to finish past the
// document (`keepalive`), but the save write itself, signed by an async
// device key through the page's own writes, is not; a browser that
// cuts it off still loses it, which this browser cannot help.
const token = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export class LiveState {
  readonly #live: Live
  readonly #at: Seat
  // Who this body was opened as: checked again before every reconnect
  // and before posting any edit, so a session that changes underneath
  // an open body, signed out, signed in as someone else, or a demo
  // reset, neither keeps driving it nor posts under the identity it no
  // longer is.
  readonly #who: string
  // Where this browser keeps a real edit of its own no save carries yet,
  // the moment it is made, so a reload right after one survives even
  // where the save itself, two round trips signed by this browser's
  // device, does not: one per the body's live address, since that is
  // this browser's own name for it.
  readonly #draft: string
  // The draft this instance last stashed or replayed, by its token: a
  // save's acknowledgement clears it only where it still names this
  // one, never a newer draft another tab kept under the same id since.
  #token: string | null = null
  online = $state(false)
  // Whether the session said what this browser may do, and whether it may
  // edit.
  joined = $state(false)
  writable = $state(false)
  // Whether this browser holds edits no save carries yet.
  unsaved = $state(false)
  problem: string | null = $state(null)
  hash = $state('')
  #source: EventSource | null = null
  #stopped = true
  // What aborts the session's posts where the browser leaves holding no
  // edit of its own, so WebKit reports no error for one cut off as the
  // document goes.
  #abort = new AbortController()

  constructor(doc: LoroDoc, at: Seat) {
    this.#at = at
    this.#who = at.who()
    // Who keeps this draft and which demo copy, ahead of the live
    // address, so a draft this browser kept signed in as one person, or
    // on a copy a reset has since moved past, never replays for another.
    this.#draft = `cella:body-draft:${this.#who}:${at.live()}`
    const link: Link = {
      post: (update) => told(at.live(), [['update', b64.encode(update)]], this.#abort.signal),
      save: async (write, snapshot, contributors, base) =>
        sent(
          await at.save(write, [
            ['snapshot', b64.encode(snapshot)],
            ['base', base],
            ...contributors.map((c): [string, string] => ['contributor', c]),
          ]),
        ),
      saved: () => kept(at.live(), this.#abort.signal),
    }
    // Before anything else, what this browser kept of its own last time
    // it held it, if it still does and is not older than a day:
    // replayed synchronously, so a record never shows less than it last
    // did, and the session below joins already holding it, which saves
    // it again at its own next pause. Its token is adopted as this
    // instance's own, so a save that carries it, made without a further
    // edit of this instance's own first, still clears it correctly.
    try {
      const raw = localStorage.getItem(this.#draft)
      if (raw) {
        const stashed = JSON.parse(raw) as { snapshot?: string; ts?: number; token?: string }
        if (typeof stashed.snapshot === 'string' && typeof stashed.ts === 'number' && Date.now() - stashed.ts <= day) {
          doc.import(b64.decode(stashed.snapshot))
          this.#token = typeof stashed.token === 'string' ? stashed.token : null
        } else {
          localStorage.removeItem(this.#draft)
        }
      }
    } catch {
      // Storage unavailable (private browsing, disabled, full), or what
      // it held was not a draft this version reads: nothing to replay,
      // and nothing kept past this that would only fail again.
      try {
        localStorage.removeItem(this.#draft)
      } catch {
        // Nothing more to do about it.
      }
    }
    this.#live = new Live(doc, link, () => this.#who.split('|')[0])
    this.#live.changed = () => this.#show()
    this.hash = hash(doc)
  }

  // Whether this browser is still signed in as who it was when this
  // body was opened.
  #current(): boolean {
    return this.#at.who() === this.#who
  }

  // Stops this body's session at once, under an identity it no longer
  // is: no further post is made, the stream closes, and the browser's
  // own draft, kept under this identity's own key, is dropped with it
  // (the reconcile a changed identity also triggers would drop it too,
  // but not necessarily before this instance would otherwise act on
  // it). Idempotent.
  #disown(): void {
    if (this.#stopped) {
      return
    }
    this.#stopped = true
    this.#source?.close()
    this.#source = null
    this.#abort.abort()
    this.writable = false
    this.online = false
    this.problem = 'signed in as someone else now: this edit was not saved here'
    this.#unstash()
  }

  // Keeps the merged document now, replacing what was kept before: called
  // the moment a real edit is made, never debounced, so a reload with
  // nothing dispatched between the keystroke and the unload still finds
  // it.
  #stash(): void {
    const t = token()
    try {
      localStorage.setItem(this.#draft, JSON.stringify({ snapshot: b64.encode(this.#live.doc.export({ mode: 'snapshot' })), ts: Date.now(), token: t }))
      this.#token = t
    } catch {
      // A draft too big to keep, or kept nowhere, is simply not replayed:
      // this browser's own save is still tried as before.
    }
  }

  // Removes the draft kept for this body, but only where it is still
  // the one this instance itself last stashed or replayed (its token):
  // another tab's newer, unsent snapshot, kept under the same id since,
  // is never cleared by this one becoming saved.
  #unstash(): void {
    if (this.#token === null) {
      return
    }
    try {
      const raw = localStorage.getItem(this.#draft)
      if (raw) {
        const stashed = JSON.parse(raw) as { token?: string }
        if (stashed.token !== this.#token) {
          return
        }
      }
      localStorage.removeItem(this.#draft)
      this.#token = null
    } catch {
      // Nothing was kept, or it cannot be reached: either way, done.
    }
  }

  #show(): void {
    this.joined = this.#live.actor !== ''
    this.writable = this.#live.writable
    this.problem = this.#live.problem
    this.unsaved = this.#live.unsaved
    // Carried by a save, this browser's own or one it heard: what was
    // kept for it is no longer needed.
    if (!this.unsaved) {
      this.#unstash()
    }
  }

  start(): () => void {
    const doc = this.#live.doc
    this.#stopped = false
    const offs = [
      doc.subscribe((batch) => {
        this.hash = hash(doc)
        if (batch.by !== 'local') {
          return
        }
        // Signed in as someone else now: this edit is dropped, not
        // posted under an identity this browser no longer is.
        if (!this.#current()) {
          this.#disown()
          return
        }
        // The editor's empty-paragraph seed, and any other commit whose
        // origin starts `seed`, changes nothing a reader would see: it
        // never dirties the body, so merely viewing an editable record
        // saves nothing, at the pause or on leaving.
        if (batch.origin?.startsWith('seed')) {
          this.#live.seeded()
        } else {
          this.#live.edited()
          this.unsaved = true
          this.#stash()
        }
      }),
    ]
    const back = () => this.#open()
    const gone = () => {
      this.online = false
    }
    // A tab hidden saves at once where it holds an edit no save carries
    // yet, this browser's own or one it heard; signed in as someone
    // else now, nothing is saved, and the session stops instead.
    const hidden = () => {
      if (!this.#current()) {
        this.#disown()
      } else if (document.visibilityState === 'hidden' && this.unsaved) {
        void this.#live.save()
      }
    }
    // A page left for another document (`pagehide`, which fires after
    // `visibilitychange` in the same task where both fire) saves too,
    // so one fired without the other still saves; `Live.save` takes one
    // at a time, so a save `hidden` already started is the same one.
    // Where nothing is held, its session posts are aborted instead,
    // which WebKit would otherwise report as the page's error; aborting
    // one a held save waits on would hold it forever, so a held save is
    // never cut off by this browser's own hand. Signed in as someone
    // else now, the session stops instead of either.
    const leaving = () => {
      if (!this.#current()) {
        this.#disown()
      } else if (this.unsaved) {
        void this.#live.save()
      } else {
        this.#abort.abort()
      }
    }
    // Back from the browser's cache, the page posts again.
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) {
        this.#abort = new AbortController()
      }
    }
    window.addEventListener('online', back)
    window.addEventListener('offline', gone)
    window.addEventListener('pagehide', leaving)
    window.addEventListener('pageshow', shown)
    document.addEventListener('visibilitychange', hidden)
    this.#open()
    return () => {
      this.#stopped = true
      for (const off of offs) {
        off()
      }
      window.removeEventListener('online', back)
      window.removeEventListener('offline', gone)
      window.removeEventListener('pagehide', leaving)
      window.removeEventListener('pageshow', shown)
      document.removeEventListener('visibilitychange', hidden)
      // The stream stays open until the leaving save is made, so the
      // session still holds this peer when it posts and tells it.
      const source = this.#source
      this.#source = null
      void this.#live.leave().finally(() => source?.close())
    }
  }

  #open(): void {
    this.#source?.close()
    if (this.#stopped) {
      return
    }
    // Signed in as someone else now: never reconnects as them.
    if (!this.#current()) {
      this.#disown()
      return
    }
    const doc = this.#live.doc
    const vv = b64.encode(doc.oplogVersion().encode())
    const source = new EventSource(`${this.#at.live()}?vv=${encodeURIComponent(vv)}&peer=${doc.peerIdStr}`)
    this.#source = source
    const data = <T>(e: Event) => JSON.parse((e as MessageEvent<string>).data) as T
    source.onopen = () => {
      this.online = true
    }
    source.addEventListener('joined', (e) => void this.#live.joined(data<Joined>(e)))
    source.addEventListener('update', (e) => {
      this.#live.heard(data<Merged>(e))
      this.unsaved = this.#live.unsaved
      this.online = true
    })
    source.addEventListener('saved', (e) => {
      this.#live.kept(data<Kept>(e))
      this.#show()
    })
    source.addEventListener('dropped', (e) => {
      this.#live.dropped(data<{ reason: string }>(e).reason)
      source.close()
    })
    // A stream that fails is reopened from where this browser stands,
    // rather than resumed by the browser from where the stream was.
    source.onerror = () => {
      source.close()
      this.online = false
      if (this.#source === source) {
        setTimeout(() => this.#open(), retry)
      }
    }
  }
}
