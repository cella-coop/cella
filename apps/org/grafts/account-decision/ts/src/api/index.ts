// The graft's reads and its slice, which the shell mounts: the decision
// approving an allocation, on the allocation's page, the decisions moving
// to adopt terms, on the terms' page, and both on a decision's own; the
// drafted terms a new decision may move to adopt. Allocating and adopting
// cite the decision; allocating is account-transaction's write, which
// posts it, and adopting the account feat's.
import type { Slice } from '@cella/org-db'
import { approvals } from '../drivers/approval.ts'
import { adoptions, drafted } from '../drivers/adoption.ts'

export { approvals } from '../drivers/approval.ts'
export { adoptions, drafted } from '../drivers/adoption.ts'
export type { Approval } from '../models/approval.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'account-decision',
  extends: {
    allocations: { item: (db, allocation) => approvals(db, { allocation }) },
    terms: { item: (db, terms) => adoptions(db, { terms }) },
    decisions: {
      about: async (db) => ({ terms: await drafted(db) }),
      item: async (db, decision) => ({ approvals: await approvals(db, { decision }), adoptions: await adoptions(db, { decision }) }),
    },
  },
}
