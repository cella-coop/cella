import type { Canon } from './canonical.ts'
import type { TreeID } from './blocks.ts'

// A Loro frontier: the last operation of each peer the document includes.
export interface OpId {
  peer: `${number}`
  counter: number
}

export type Frontier = OpId[]

export interface Edit {
  document: string
  // A Loro update, as Loro exports it.
  update: Uint8Array
}

export interface Edited {
  document: string
  receipt: number
  // BLAKE3 of the update's bytes, hex.
  digest: string
}

// Saves the document at a frontier the saver read, or the merged draft.
export interface Save {
  document: string
  frontier?: Frontier
}

export interface Saved {
  version: string
  n: number
  // BLAKE3 of the version's canonical JSON, hex, as the database computes
  // it from the snapshot.
  hash: string
  frontier: Frontier
}

// A comment on a version, on the text it quotes, which must lie within
// one block of the version.
export interface Comment {
  version: string
  quote: string
  text: string
}

export interface Commented {
  comment: number
  version: string
}

// Where a comment sits: the block holding its quote and Loro cursors at
// the quote's two ends, each as Loro encodes it, in base64. A cursor
// names a character, not an offset, so it finds the quote in the draft
// however the text around it moved.
export interface Anchor {
  block: TreeID
  from: string
  to: string
}

// Adoption cites the decision that adopts; the grafts on the op resolve
// it, so this feat holds it as an id.
export interface Adopt {
  document: string
  version: string
  // The adopted version this one replaces, as the adopter read it.
  base: string | null
  decision: string
}

export interface Adopted {
  document: string
  version: string
  // The adopted version's hash, which the log commits to.
  hash: string
  adopted: string
  receipt: number
}

// A document as the feat lists it.
export interface Listed {
  id: string
  title: string
  versions: number
  adopted: string | null
  edited: string | null
}

export interface Version {
  id: string
  n: number
  saved: string
  hash: string
  adopted: boolean
}

export interface Note {
  id: string
  version: string
  author: string
  at: string
  quote: string
  text: string
  resolved: boolean
  anchor: Anchor | null
}

export interface Update {
  id: string
  receipt: number
  author: string | null
  at: string
}

// A document's page: its draft as a Loro snapshot in base64, with its
// canonical form for the first render; its versions, the adopted one,
// its comments and its updates, newest first.
export interface Page {
  id: string
  title: string
  snapshot: string
  draft: Canon
  // The draft's canonical hash, as the browser previews it.
  hash: string
  adopted: string | null
  versions: Version[]
  comments: Note[]
  updates: Update[]
}

// A version as a reader shows it: its canonical form and hash as the
// database computed them.
export interface Shown {
  id: string
  document: string
  hash: string
  canonical: Canon
}

// One update on the live stream: its receipt (0 for the catch-up) and
// its bytes, in base64.
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
