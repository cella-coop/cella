import type { LoroDoc } from 'loro-crdt'
import { atomic, kind, order, text } from './blocks.ts'
import { b64, type Anchor } from './body.ts'

// Where a quote sits in a document: the first block in reading order
// whose text holds it, and Loro cursors at its two ends, which name the
// characters and so find the quote in any later draft; null when no one
// block holds it.
export function anchor(doc: LoroDoc, quote: string): Anchor | null {
  for (const { id } of order(doc)) {
    if (atomic.has(kind(doc, id))) {
      continue
    }
    const t = text(doc, id)
    const at = t.toString().indexOf(quote)
    if (at < 0) {
      continue
    }
    const from = t.getCursor(at, 1)
    const to = t.getCursor(at + quote.length, -1)
    if (from && to) {
      return { block: id, from: b64.encode(from.encode()), to: b64.encode(to.encode()) }
    }
  }
  return null
}
