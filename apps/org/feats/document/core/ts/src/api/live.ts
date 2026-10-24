import { VersionVector } from 'loro-crdt'
import type { Stream } from '@cella/org-db'
import { b64, type Relayed } from '../models/document.ts'
import { merged } from '../handlers/loro.ts'

// The live relay: each settled edit is published to the streams open on
// its document, as server-sent events, so every member with it open
// imports the update as it lands. The relay lives in this server process,
// kept on `globalThis` so that a reloaded module in development finds the
// same subscribers; a second server process would relay through
// Postgres's LISTEN and NOTIFY instead.
type Listener = (r: Relayed) => void

const key = Symbol.for('cella.document.relay')
const relay = ((globalThis as Record<symbol, unknown>)[key] ??= new Map<string, Set<Listener>>()) as Map<string, Set<Listener>>

export function publish(document: string, receipt: number, update: Uint8Array): void {
  const r = { receipt, update: b64.encode(update) }
  for (const l of relay.get(document) ?? []) {
    l(r)
  }
}

function listen(document: string, l: Listener): () => void {
  const set = relay.get(document) ?? new Set()
  relay.set(document, set)
  set.add(l)
  return () => {
    set.delete(l)
    if (!set.size) {
      relay.delete(document)
    }
  }
}

const encoder = new TextEncoder()
const event = (r: Relayed) => encoder.encode(`event: update\ndata: ${JSON.stringify(r)}\n\n`)

// A document's live updates. It opens with one update holding everything
// the client lacks, by the Loro version vector it sends (`vv`, encoded,
// in base64), so a client that reconnects misses nothing whatever order
// writes committed in; then each edit as it settles. Listening starts
// before the catch-up is read, so nothing falls between; what arrives
// twice, Loro imports once. A comment line every 20 seconds keeps
// proxies from closing a quiet stream.
export const live: Stream = ({ using, id, url, signal }) => {
  let stop = () => {}
  return new ReadableStream<Uint8Array>({
    async start(c) {
      const off = listen(id, (r) => c.enqueue(event(r)))
      const beat = setInterval(() => c.enqueue(encoder.encode(': beat\n\n')), 20_000)
      stop = () => {
        off()
        clearInterval(beat)
      }
      signal.addEventListener('abort', () => {
        stop()
        try {
          c.close()
        } catch {
          // the client closed it already
        }
      })
      const vv = url.searchParams.get('vv')
      const doc = await using((db) => merged(db, id))
      const from = vv ? VersionVector.decode(b64.decode(vv)) : undefined
      const update = doc.export({ mode: 'update', from })
      c.enqueue(event({ receipt: 0, update: b64.encode(update) }))
    },
    cancel() {
      stop()
    },
  })
}
