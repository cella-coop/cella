import type { App } from '@cella/org-ui'
import Work from './blocks/Work.svelte'

// The graft's client side: a surplus's work share, member by member, on
// the allocation's page.
export const app: App = {
  name: 'account-payslip',
  extends: {
    allocations: { page: { blocks: [Work] } },
  },
}
