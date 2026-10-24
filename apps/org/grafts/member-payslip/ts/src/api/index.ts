// The graft's reads and its slice, which the shell mounts: whose each
// payslip is, and a member's salary and payslips on their page.
import type { Slice } from '@cella/org-db'
import { names, pay } from '../drivers/pay.ts'

export { names, pay } from '../drivers/pay.ts'

export const slice: Slice = {
  name: 'member-payslip',
  extends: {
    payslips: { list: names },
    members: { item: pay },
  },
}
