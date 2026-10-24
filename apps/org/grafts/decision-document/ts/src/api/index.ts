// The graft's reads and its slice, which the shell mounts: what a
// decision adopts, in full on the decision's page, and the decisions on a
// document's, which its draft may embed. Adopting through the shell is
// not offered yet.
import type { Slice } from '@cella/org-db'
import { onDecision, onDocument } from '../drivers/adoption.ts'

export { asked, summaries, onDecision, onDocument } from '../drivers/adoption.ts'

export const slice: Slice = {
  name: 'decision-document',
  extends: {
    decisions: { item: (db, decision) => onDecision(db, decision) },
    documents: { item: (db, document) => onDocument(db, document) },
  },
}
