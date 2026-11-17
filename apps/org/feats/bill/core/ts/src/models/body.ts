import type { Canon } from '@cella/org-body/models'

// A record's body, as its page reads it: a Loro snapshot in base64,
// which the browser's editor opens, and its canonical form, which the
// page draws until it does, null both where it has none yet; and an
// editor's save of it, the merged snapshot as its browser holds it, the
// hash of the saved body it merged, empty for none, and who contributed
// since the last save, by address.

export interface Bodied {
  snapshot: string | null
  canon: Canon | null
}

export interface BodySave {
  bill: string
  snapshot: Uint8Array
  base: string
  contributors: string[]
}

export interface BodySaved {
  bill: string
  circle: string
}
