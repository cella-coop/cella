// The graft's reads and its slice, which the shell mounts: the months
// waiting on the acting member's approval, in their inbox. Who approves
// whose time is its SQL guard.
import type { Slice } from '@cella/org-db'
import { approvals } from '../drivers/inbox.ts'

export { approvals } from '../drivers/inbox.ts'

export const slice: Slice = {
  name: 'circle-membership-timesheet',
  extends: {
    inbox: { rows: approvals },
  },
}
