// The graft's reads and its slice, which the shell mounts: the decisions
// moving to adopt the capital's terms, on the terms' page and on a
// decision's own; the drafted terms a new decision may move to adopt.
// Adopting cites the decision, and is the account feat's write.
import type { Slice } from '@cella/org-db'
import { adoptions, drafted } from '../drivers/adoption.ts'

export { adoptions, drafted } from '../drivers/adoption.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'account-decision',
  extends: {
    terms: { item: (db, terms) => adoptions(db, { terms }) },
    decisions: {
      about: async (db) => ({ terms: await drafted(db) }),
      item: (db, decision) => adoptions(db, { decision }),
    },
  },
}
