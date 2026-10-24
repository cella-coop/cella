// A Loro frontier: the last operation of each peer the text includes.
export interface OpId {
  peer: `${number}`
  counter: number
}

export type Frontier = OpId[]

// The Loro text container every document keeps its body in.
export const body = 'body'

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

// Saves the text at a frontier the saver read, or the merged draft.
export interface Save {
  document: string
  frontier?: Frontier
}

export interface Saved {
  version: string
  n: number
  // BLAKE3 of the canonical body, hex.
  hash: string
  frontier: Frontier
}

export interface Comment {
  version: string
  quote: string
  text: string
}

export interface Commented {
  comment: number
  version: string
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
  adopted: string
  receipt: number
}

// Canonical markdown, as `document.version` requires: LF line endings, NFC,
// no trailing blank lines and one final newline. A version's hash is over
// exactly this text.
export const canonical = (text: string) =>
  `${text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').normalize('NFC').replace(/\s+$/, '')}\n`
