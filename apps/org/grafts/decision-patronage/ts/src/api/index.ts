// The graft's reads and its slice, which the shell mounts: the decision
// approving a distribution, on the distribution's page, the decisions
// moving to adopt the work share's terms, on the terms' page, and both on
// a decision's own; the drafted terms a new decision may move to adopt.
// Approving and adopting cite the decision; both are the patronage feat's
// writes.
import type { Slice } from '@cella/org-db'
import { approvals } from '../drivers/approval.ts'
import { adoptions, drafted } from '../drivers/adoption.ts'

export { approvals } from '../drivers/approval.ts'
export { adoptions, drafted } from '../drivers/adoption.ts'
export type { Approval } from '../models/approval.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'decision-patronage',
  extends: {
    distributions: { item: (db, distribution) => approvals(db, { distribution }) },
    bases: { item: (db, terms) => adoptions(db, { terms }) },
    decisions: {
      about: async (db) => ({ bases: await drafted(db) }),
      item: async (db, decision) => ({ approvals: await approvals(db, { decision }), adoptions: await adoptions(db, { decision }) }),
    },
  },
}
