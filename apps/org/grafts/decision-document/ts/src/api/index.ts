// The graft's reads and its slice, which the shell mounts: what a
// decision adopts, in full on the decision's page, the versions a new
// decision may propose to adopt, and the decisions on a document's page,
// which its draft may embed.
import type { Slice } from '@cella/org-db'
import { onDecision, onDocument, versions } from '../drivers/adoption.ts'

export { asked, summaries, onDecision, onDocument, versions } from '../drivers/adoption.ts'

export const slice: Slice = {
  name: 'decision-document',
  extends: {
    decisions: {
      about: async (db) => ({ versions: await versions(db) }),
      item: (db, decision) => onDecision(db, decision),
    },
    documents: { item: (db, document) => onDocument(db, document) },
  },
}
