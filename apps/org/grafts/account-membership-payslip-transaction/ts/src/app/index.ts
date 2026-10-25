import type { App } from '@cella/org-ui'
import Instalments from './blocks/Instalments.svelte'
import Withheld from './blocks/Withheld.svelte'

// The graft's client side: an associate's instalments from their pay and
// spreading their subscription, on their page; what a payslip's pay
// withheld, on the payslip's.
export const app: App = {
  name: 'account-membership-payslip-transaction',
  extends: {
    people: { page: { blocks: [Instalments] } },
    payslips: { page: { blocks: [Withheld] } },
  },
}
