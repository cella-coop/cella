import type { Summary } from '@cella/org-decision/models'
import type { Canon } from '@cella/org-document/models'

// A document a decision asks to adopt, named by its canonical hash, the
// version the proposer read it in, and the day it was adopted, once it
// was.
export interface Asked {
  id: string
  decision: string
  title: string
  document: string
  version: string
  hash: string
  adopted: string | null
}


// What a decision asks to adopt, as its page shows it: the version in
// full, as the database canonicalised it, and the version now adopted,
// which it would replace.
export interface Adopting extends Asked {
  name: string
  canonical: Canon
  current: string | null
}

// The graft's data on a decision's page.
export interface OnDecision {
  adopting: Adopting[]
  decisions: Summary[]
}

// The graft's data on a document's page: the decisions adopting it, and
// the decisions it may embed.
export interface OnDocument {
  asked: Asked[]
  decisions: Summary[]
}
