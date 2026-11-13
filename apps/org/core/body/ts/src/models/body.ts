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

// What a record's live session tells an editor as it opens the body:
// whether it may edit, its own address, the name of the save action its
// browser saves through, the session's Loro version vector and the last
// save's, each encoded, in base64, and who contributed since that save.
export interface Joined {
  writable: boolean
  actor: string
  save: string
  version: string
  saved: string
  contributors: string[]
}

// An update the session merged, as it relays it, with who contributed
// since the last save, by address, sorted.
export interface Merged extends Relayed {
  contributors: string[]
}

// A save the session learned of: the version vector of the snapshot the
// record now holds, encoded, in base64, and who contributed since it.
export interface Kept {
  saved: string
  contributors: string[]
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

// Whether `doc` holds an edit `saved` does not: something a save made now
// would carry that the last did not.
export function ahead(doc: LoroDoc, saved: VersionVector): boolean {
  for (const [peer, n] of doc.oplogVersion().toJSON()) {
    if (n > (saved.get(peer) ?? 0)) {
      return true
    }
  }
  return false
}
