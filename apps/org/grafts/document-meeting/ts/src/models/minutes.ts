import type { Canon } from '@cella/org-document/models'

// A meeting as an embed draws it inside a document, and as the slash menu
// offers it.
export interface Summary {
  id: string
  title: string
  circle: string
  at: string
  status: string
}

// A meeting's minutes: the document, its draft read from its canonical
// form, its latest version and the version adopted, if any.
export interface Minutes {
  document: string
  title: string
  draft: Canon
  versions: number
  latest: string | null
  adopted: string | null
}

// The graft's data on a meeting's page: its minutes, if begun, whether
// they may still be, and the meetings its minutes may embed.
export interface OnMeeting {
  minutes: Minutes | null
  cancelled: boolean
  meetings: Summary[]
}

// The graft's data on a document's page: the meeting it minutes, if any,
// and the meetings it may embed.
export interface OnDocument {
  of: Summary | null
  meetings: Summary[]
}

export interface Minute {
  meeting: string
}

export interface Minuted {
  meeting: string
  minuted: string
  document: string
  // The opening update's digest, when this write began the minutes.
  digest: string | null
}
