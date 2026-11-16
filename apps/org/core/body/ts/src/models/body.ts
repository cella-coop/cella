import { VersionVector, type LoroDoc } from 'loro-crdt'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
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
// save's, each encoded, in base64, who contributed since that save, and
// the hash of the body the record holds, which the browser's next save
// names as its `base`, empty where it holds none.
export interface Joined {
  writable: boolean
  actor: string
  save: string
  version: string
  saved: string
  contributors: string[]
  base: string
}

// An update the session merged, as it relays it, with who contributed
// since the last save, by address, sorted.
export interface Merged extends Relayed {
  contributors: string[]
}

// A save the session learned of: the snapshot the record now holds and
// its version vector, encoded, each in base64, its hash, which a browser
// that imports it names as its next save's `base`, and who contributed
// since it.
export interface Kept {
  saved: string
  snapshot: string
  base: string
  contributors: string[]
}

// The hash a save names the body it merged by, its `base`: the SHA-256 of
// the saved snapshot's bytes, in hex, as the feat's guard reads
// `encode(sha256(body), 'hex')`; empty for a body never saved.
export function baseOf(snapshot: Uint8Array | null): string {
  return snapshot ? bytesToHex(sha256(snapshot)) : ''
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

// Whether `doc` holds every edit of `saved`: a save made now would carry
// the body that version names.
export function holds(doc: LoroDoc, saved: VersionVector): boolean {
  const version = doc.oplogVersion()
  for (const [peer, n] of saved.toJSON()) {
    if (n > (version.get(peer) ?? 0)) {
      return false
    }
  }
  return true
}
