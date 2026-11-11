import type { Anchor, Canon, Fragment } from '@cella/org-body/models'

// A Loro frontier: the last operation of each peer the document includes.
export interface OpId {
  peer: `${number}`
  counter: number
}

export type Frontier = OpId[]

// A new document, by its id or its title's slug, and the blocks its
// draft opens with.
export interface Create {
  id?: string
  title: string
  blocks?: Fragment[]
  // The circle it is owned by, by id; the root's, the assembly's, when
  // none is named.
  circle?: string | null
}

export interface Created {
  document: string
  // The opening update's receipt and BLAKE3 digest, hex, when it has one.
  receipt: number | null
  digest: string | null
}

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

// Adoption cites the motion that adopts; the grafts on the op resolve
// it, so this feat holds it as an id.
export interface Adopt {
  document: string
  version: string
  // The adopted version this one replaces, as the adopter read it.
  base: string | null
  motion: string
}

export interface Adopted {
  document: string
  version: string
  // The adopted version's hash, which the log commits to.
  hash: string
  adopted: string
  receipt: number
}

// Generates a generated document from its circle's policies in force on
// the day a motion's adoption or ending of one applies, citing that
// motion, which this feat holds as an id.
export interface Generate {
  document: string
  motion: string
  // YYYY-MM-DD.
  day: string
}

export interface Generated {
  document: string
  version: string
  // The version's hash, which the log commits to.
  hash: string
  // The adopted version it replaces.
  base: string | null
  adopted: string
  receipt: number
  // The policies it reads, in order.
  policies: string[]
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
  // The circle whose policies it is generated from, if it is.
  generated: string | null
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
