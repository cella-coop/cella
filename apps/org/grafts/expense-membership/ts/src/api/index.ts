// The graft's reads and its slice, which the shell mounts: whose each
// expense is and who decided it, a member's expenses on their page, and
// the expenses waiting on the acting member's approval or reimbursement,
// in their inbox. A mandate's budget is its SQL guard.
import type { Slice } from '@cella/org-db'
import { claim, claimed, claims } from '../drivers/claim.ts'
import { expenses } from '../drivers/inbox.ts'

export { claim, claimed, claims } from '../drivers/claim.ts'
export { expenses } from '../drivers/inbox.ts'

export const slice: Slice = {
  name: 'expense-membership',
  extends: {
    expenses: { list: claims, item: claim },
    people: { item: claimed },
    inbox: { rows: expenses },
  },
}
