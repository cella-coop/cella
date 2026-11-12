import { took, type Answer } from '@cella/org-ui'
import { VersionVector, type LoroDoc } from 'loro-crdt'
import { hash } from '../models/canonical.ts'
import { b64, type Relayed } from '../models/body.ts'

const pause = 250
const retry = 2000

// Where a draft lives, as the slice that mounts it says: the URL of its
// live stream, and the write that takes an edit, its update in the
// `update` field, sent by the page's `send` and signed as any write is.
export interface Where {
  live: () => string
  edit: (fields: [string, string][]) => Promise<Answer>
}

// A draft kept live with the server. This peer's own edits are sent as
// one Loro update every quarter second while it types, through the edit
// write the mounting slice names, signed as the acting member; everyone
// else's arrive on the live stream it names as they settle, and are
// imported. Offline, edits wait and go when the network returns; the
// stream reopens with this peer's version vector, so it misses nothing.
// The draft's canonical hash, what a version saved now would be named by,
// follows every change.
export class SyncState {
  readonly #doc: LoroDoc
  readonly #at: Where
  online = $state(false)
  // Whether this peer has edits the server does not hold yet.
  waiting = $state(false)
  // Why the server refused this peer's last edit.
  problem: string | null = $state(null)
  hash = $state('')
  #sent = 0
  #sending = false
  #timer: ReturnType<typeof setTimeout> | undefined
  #source: EventSource | null = null
  #stopped = true

  constructor(doc: LoroDoc, at: Where) {
    this.#doc = doc
    this.#at = at
    this.hash = hash(doc)
  }

  get #own(): number {
    return this.#doc.oplogVersion().get(this.#doc.peerIdStr) ?? 0
  }

  start(): () => void {
    this.#stopped = false
    const offs = [
      this.#doc.subscribeLocalUpdates(() => {
        this.waiting = true
        this.#later(pause)
      }),
      this.#doc.subscribe(() => {
        this.hash = hash(this.#doc)
      }),
    ]
    const back = () => {
      this.#open()
      this.#later(0)
    }
    const gone = () => {
      this.online = false
    }
    window.addEventListener('online', back)
    window.addEventListener('offline', gone)
    this.#open()
    return () => {
      this.#stopped = true
      for (const off of offs) {
        off()
      }
      window.removeEventListener('online', back)
      window.removeEventListener('offline', gone)
      clearTimeout(this.#timer)
      this.#source?.close()
      this.#source = null
    }
  }

  #open(): void {
    this.#source?.close()
    if (this.#stopped) {
      return
    }
    const vv = b64.encode(this.#doc.oplogVersion().encode())
    const source = new EventSource(`${this.#at.live()}?vv=${encodeURIComponent(vv)}`)
    this.#source = source
    source.onopen = () => {
      this.online = true
    }
    source.addEventListener('update', (e) => {
      const r = JSON.parse((e as MessageEvent<string>).data) as Relayed
      this.#doc.import(b64.decode(r.update))
      this.online = true
    })
    // A stream that fails is reopened from where this peer stands, rather
    // than resumed by the browser from where the stream was.
    source.onerror = () => {
      source.close()
      this.online = false
      if (this.#source === source) {
        setTimeout(() => this.#open(), retry)
      }
    }
  }

  #later(ms: number): void {
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.#send(), ms)
  }

  // Everything of this peer's since the last update the server took, as
  // one update, posted to the slice's edit action.
  async #send(): Promise<void> {
    if (this.#sending || this.#stopped) {
      return
    }
    const upto = this.#own
    if (upto <= this.#sent) {
      this.waiting = false
      return
    }
    const vv = this.#doc.oplogVersion().toJSON()
    if (this.#sent) {
      vv.set(this.#doc.peerIdStr, this.#sent)
    } else {
      vv.delete(this.#doc.peerIdStr)
    }
    const update = this.#doc.export({ mode: 'update', from: VersionVector.parseJSON(vv) })
    this.#sending = true
    try {
      const out = await this.#at.edit([['update', b64.encode(update)]])
      if (took(out)) {
        this.#sent = upto
        this.problem = null
      } else if ('done' in out) {
        this.problem = out.done?.reason ?? `the edit was refused (${out.status})`
      } else {
        throw new Error('not taken')
      }
    } catch {
      this.online = false
      this.#later(retry)
    } finally {
      this.#sending = false
    }
    if (this.#own > this.#sent && !this.problem) {
      this.#later(pause)
    } else {
      this.waiting = this.#own > this.#sent
    }
  }
}
