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
async function kept(url: string, signal: AbortSignal): Promise<Kept> {
  const body = new FormData()
  body.append('saved', '1')
  const res = await fetch(url, { method: 'POST', body, headers: { accept: 'application/json' }, signal })
  const r = (await res.json()) as { type: string; data?: Kept & { done?: { reason?: string } } }
  if (r.type !== 'success' || !r.data) {
    throw new Error(r.data?.done?.reason ?? `refused (${res.status})`)
  }
  return r.data
}

// A post to the live session, answered as a form's is. One with no
// answer it can read throws, which reads as being offline.
async function told(url: string, fields: [string, string][], signal: AbortSignal): Promise<Sent> {
  const body = new FormData()
  for (const [k, v] of fields) {
    body.append(k, v)
  }
  const res = await fetch(url, { method: 'POST', body, headers: { accept: 'application/json' }, signal })
  if (res.status === 401) {
    return { ok: false, reason: 'sign in first' }
  }
  const r = (await res.json()) as { type: string; data?: { done?: { reason?: string } } }
  return r.type === 'success' ? { ok: true } : { ok: false, reason: r.data?.done?.reason ?? `refused (${res.status})` }
}

// A record's body kept live in the browser over its session: its updates
// posted to the session's address, and its saves sent as the feat's save
// write, each signed by this browser's device as every write is. It saves
// at a pause and when it leaves the body, the page's unmounting or the
// tab's hiding; the stream reopens with this browser's version vector, so
// it misses nothing. A page the browser leaves for another document
// (`pagehide`) makes no request after: its posts to the session in
// flight are aborted, and the save its hiding asks for is made a task
// later, after `pagehide` would have said so, and only where it did not,
// since a request the browser cuts off as the document goes saves
// nothing, and WebKit reports it as the page’s error. An abort sets no
// problem the body shows.
export class LiveState {
  readonly #live: Live
  readonly #at: Seat
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
  // Whether the browser is leaving the page for another document, and
  // what aborts the session's posts as it does.
  #leaving = false
  #abort = new AbortController()

  constructor(doc: LoroDoc, at: Seat) {
    this.#at = at
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
    this.#live = new Live(doc, link)
    this.#live.changed = () => this.#show()
    this.hash = hash(doc)
  }

  #show(): void {
    this.joined = this.#live.actor !== ''
    this.writable = this.#live.writable
    this.problem = this.#live.problem
    this.unsaved = this.#live.unsaved
  }

  start(): () => void {
    const doc = this.#live.doc
    this.#stopped = false
    const offs = [
      doc.subscribeLocalUpdates(() => {
        this.#live.edited()
        this.unsaved = true
      }),
      doc.subscribe(() => {
        this.hash = hash(doc)
      }),
    ]
    const back = () => this.#open()
    const gone = () => {
      this.online = false
    }
    // A tab hidden saves, a task later: a page being left fires
    // `pagehide` after `visibilitychange` in the same task.
    const hidden = () => {
      if (document.visibilityState === 'hidden') {
        setTimeout(() => {
          if (!this.#leaving) {
            void this.#live.save()
          }
        }, 0)
      }
    }
    const leaving = () => {
      this.#leaving = true
      this.#abort.abort()
    }
    // Back from the browser's cache, the page posts again.
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) {
        this.#leaving = false
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
