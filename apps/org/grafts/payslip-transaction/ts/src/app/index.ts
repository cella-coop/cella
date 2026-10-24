import type { App } from '@cella/org-ui'
import type { Posted } from '../models/posting.ts'

const says = { accrual: 'accrued the run', payment: 'paid the run', carried: 'the run, carried over' }

// The graft's client side: the entries a payslip's run put in the books.
export const app: App = {
  name: 'payslip-transaction',
  extends: {
    payslips: {
      page: {
        related: (p: Posted[]) => p.map((x) => ({ label: x.entry, sub: says[x.event], href: `/transactions/${x.entry}` })),
      },
    },
  },
}
