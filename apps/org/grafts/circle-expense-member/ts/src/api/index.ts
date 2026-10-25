// The graft's reads and its slice, which the shell mounts: the expenses
// waiting on the acting member's approval or reimbursement, in their
// inbox. A mandate's budget is its SQL rule.
import type { Slice } from '@cella/org-db'
import { expenses } from '../drivers/inbox.ts'

export { expenses } from '../drivers/inbox.ts'

export const slice: Slice = {
  name: 'circle-expense-member',
  extends: {
    inbox: { rows: (db, actor) => expenses(db, actor) },
  },
}
