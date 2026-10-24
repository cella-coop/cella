import type { App } from '@cella/org-ui'
import type { Pay } from '../models/pay.ts'
import Payslips from './blocks/Payslips.svelte'

// The graft's client side: whose each payslip is, and a member's salary
// and payslips on their page.
export const app: App = {
  name: 'member-payslip',
  extends: {
    payslips: {
      columns: [{ key: 'name', label: 'Member', role: 'sub', value: (r: { name?: string }) => r.name ?? '' }],
    },
    members: {
      page: {
        properties: (p: Pay) => (p.salary ? [{ label: 'Gross salary', value: p.salary, kind: 'money' }] : []),
        blocks: [Payslips],
      },
    },
  },
}
