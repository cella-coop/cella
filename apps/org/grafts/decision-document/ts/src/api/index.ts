// The graft's reads and its slice, which the shell mounts: which version a
// decision adopts, on the decision's page and the document's. Adopting
// through the shell is not offered yet.
import type { Slice } from '@cella/org-db'
import { asked } from '../drivers/adoption.ts'

export { asked } from '../drivers/adoption.ts'

export const slice: Slice = {
  name: 'decision-document',
  extends: {
    decisions: { item: (db, decision) => asked(db, { decision }) },
    documents: { item: (db, document) => asked(db, { document }) },
  },
}
