import { VersionVector, type LoroDoc } from 'loro-crdt'
import type { TreeID } from './blocks.ts'

export type { LoroDoc }

// Where a quote sits: the block holding it and Loro cursors at its two
// ends, each as Loro encodes it, in base64. A cursor names a character,
// not an offset, so it finds the quote however the text around it moved.
export interface Anchor {
  block: TreeID
  from: string
  to: string
}

// One update on a body's live stream: its receipt (0 for the catch-up)
// and its bytes, in base64.
export interface Relayed {
  receipt: number
  update: string
}

export const b64 = {
  encode(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) {
      s += String.fromCharCode(b)
    }
    return btoa(s)
  },
  decode(s: string): Uint8Array {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  },
}

// Everything a peer lacks, as one update, by the Loro version vector it
// sent (encoded, in base64); all of it where it sent none.
export function since(doc: LoroDoc, vv?: string | null): Uint8Array {
  const from = vv ? VersionVector.decode(b64.decode(vv)) : undefined
  return doc.export({ mode: 'update', from })
}
