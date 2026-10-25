import type { App } from '@cella/org-ui'
import type { Pay } from '../models/pay.ts'
import Payslips from './blocks/Payslips.svelte'

// The graft's client side: whose each payslip is, each worker's salary,
// and a worker's salary and payslips on their page.
export const app: App = {
  name: 'payslip-worker',
  extends: {
    payslips: {
      columns: [{ key: 'name', label: 'Worker', role: 'sub', value: (r: { name?: string }) => r.name ?? '' }],
    },
    workers: {
      columns: [{ key: 'salary', label: 'Gross salary', kind: 'money', role: 'hidden', value: (r: { salary?: number }) => r.salary ?? null }],
      page: {
        properties: (p: Pay) => (p.salary ? [{ label: 'Gross salary', value: p.salary, kind: 'money' }] : []),
        blocks: [Payslips],
      },
    },
  },
}
