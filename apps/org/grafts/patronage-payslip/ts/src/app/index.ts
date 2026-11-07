import type { App } from '@cella/org-ui'
import Work from './blocks/Work.svelte'

// The graft's client side: a surplus's work share, member by member, on
// the distribution's Split tab.
export const app: App = {
  name: 'patronage-payslip',
  extends: {
    distributions: { page: { blocks: [{ tab: 'split', block: Work }] } },
  },
}
