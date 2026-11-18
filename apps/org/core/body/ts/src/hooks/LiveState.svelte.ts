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
// `contributor` field an address.
export interface Seat {
  live: () => string
  save: (write: string, fields: [string, string][]) => Promise<Answer>
}

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
export class LiveState {
  readonly #live: Live
  readonly #at: Seat
  // Where this browser keeps a real edit of its own no save carries yet,
  // the moment it is made, so a reload right after one survives even
  // where the save itself, two round trips signed by this browser's
  // device, does not: one per the body's live address, since that is
  // this browser's own name for it.
  readonly #draft: string
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
    this.#draft = `cella:body-draft:${at.live()}`
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
    // it held it, if it still does: replayed synchronously, so a record
    // never shows less than it last did, and the session below joins
    // already holding it, which saves it again at its own next pause.
    try {
      const stashed = localStorage.getItem(this.#draft)
      if (stashed) {
        doc.import(b64.decode(stashed))
      }
    } catch {
      // Storage unavailable (private browsing, disabled, full), or what
      // it held was not a draft this version of Loro reads: nothing to
      // replay, and nothing kept past this that would only fail again.
      try {
        localStorage.removeItem(this.#draft)
      } catch {
        // Nothing more to do about it.
      }
    }
    this.#live = new Live(doc, link)
    this.#live.changed = () => this.#show()
    this.hash = hash(doc)
  }

  // Keeps the merged document now, replacing what was kept before: called
  // the moment a real edit is made, never debounced, so a reload with
  // nothing dispatched between the keystroke and the unload still finds
  // it.
  #stash(): void {
    try {
      localStorage.setItem(this.#draft, b64.encode(this.#live.doc.export({ mode: 'snapshot' })))
    } catch {
      // A draft too big to keep, or kept nowhere, is simply not replayed:
      // this browser's own save is still tried as before.
    }
  }

  #unstash(): void {
    try {
      localStorage.removeItem(this.#draft)
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
    // yet, this browser's own or one it heard.
    const hidden = () => {
      if (document.visibilityState === 'hidden' && this.unsaved) {
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
    // never cut off by this browser's own hand.
    const leaving = () => {
      if (this.unsaved) {
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
