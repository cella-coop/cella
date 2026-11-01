// The graft's reads and its slice, which the shell mounts: the motions
// moving to adopt the capital's terms, on the terms' page and on a
// motion's own; the drafted terms a new motion may move to adopt.
// Adopting cites the motion, and is the account feat's write.
import type { Slice } from '@cella/org-db'
import { adoptions, drafted } from '../drivers/adoption.ts'

export { adoptions, drafted } from '../drivers/adoption.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'account-motion',
  extends: {
    terms: { item: (db, terms) => adoptions(db, { terms }) },
    motions: {
      about: async (db) => ({ terms: await drafted(db) }),
      item: (db, motion) => adoptions(db, { motion }),
    },
  },
}
