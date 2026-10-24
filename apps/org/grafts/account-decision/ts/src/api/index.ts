// The graft's reads and its slice, which the shell mounts: the decision
// approving an allocation, on the allocation's page, and what a decision
// allocates, on its own. Allocating cites the decision; the write is
// account-transaction's, which posts it.
import type { Slice } from '@cella/org-db'
import { approvals } from '../drivers/approval.ts'

export { approvals } from '../drivers/approval.ts'
export type { Approval } from '../models/approval.ts'

export const slice: Slice = {
  name: 'account-decision',
  extends: {
    allocations: { item: (db, allocation) => approvals(db, { allocation }) },
    decisions: { item: (db, decision) => approvals(db, { decision }) },
  },
}
