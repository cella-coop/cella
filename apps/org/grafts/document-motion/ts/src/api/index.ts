// The graft's reads and its slice, which the shell mounts: what a
// motion adopts, in full on the motion's page, the versions a new
// motion may propose to adopt, and the motions on a document's page,
// which its draft may embed.
import type { Slice } from '@cella/org-db'
import { onMotion, onDocument, versions } from '../drivers/adoption.ts'

export { asked, onMotion, onDocument, versions } from '../drivers/adoption.ts'

export const slice: Slice = {
  name: 'document-motion',
  extends: {
    motions: {
      about: async (db) => ({ versions: await versions(db) }),
      item: (db, motion) => onMotion(db, motion),
    },
    documents: { item: (db, document) => onDocument(db, document) },
  },
}
