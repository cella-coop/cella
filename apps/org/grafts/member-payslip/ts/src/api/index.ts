// The graft's reads and its slice, which the shell mounts: a member's
// salary and payslips on their page. Whose each payslip is, a worker's,
// is payslip-worker's.
import type { Slice } from '@cella/org-db'
import { pay } from '../drivers/pay.ts'

export { pay } from '../drivers/pay.ts'

export const slice: Slice = {
  name: 'member-payslip',
  extends: {
    members: { item: pay },
  },
}
