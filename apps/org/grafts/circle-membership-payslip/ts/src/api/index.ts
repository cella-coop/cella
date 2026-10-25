// The graft's reads and its slice, which the shell mounts: the pay runs
// waiting on the acting member, in their inbox.
import type { Slice } from '@cella/org-db'
import { runs } from '../drivers/inbox.ts'

export { runs } from '../drivers/inbox.ts'

export const slice: Slice = {
  name: 'circle-membership-payslip',
  extends: {
    inbox: { rows: runs },
  },
}
