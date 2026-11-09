import type { Canon } from '@cella/org-body/models'

// A project's body, written by `cella scaffold body project`: as its page reads
// it, a Loro snapshot in base64, which the browser's editor opens, and its
// canonical form, which the page draws until it does, null both where it
// has none yet; and an editor's save of it, the merged snapshot as its
// browser holds it and who contributed since the last save, by address.

export interface Bodied {
  snapshot: string | null
  canon: Canon | null
}

export interface BodySave {
  project: string
  snapshot: Uint8Array
  contributors: string[]
}

export interface BodySaved {
  project: string
  circle: string
}
