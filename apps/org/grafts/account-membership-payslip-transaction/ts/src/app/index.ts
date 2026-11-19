import type { App } from '@cella/org-ui'
import Instalments from './blocks/Instalments.svelte'
import Withheld from './blocks/Withheld.svelte'

// The graft's client side: an associate's instalments from their pay and
// spreading their subscription, under Own and decide on their page; what a payslip's pay
// withheld, a panel after the payslip's pay.
export const app: App = {
  name: 'account-membership-payslip-transaction',
  extends: {
    people: { page: { blocks: [{ tab: 'membership', block: Instalments }] } },
    payslips: { page: { blocks: [Withheld] } },
  },
}
