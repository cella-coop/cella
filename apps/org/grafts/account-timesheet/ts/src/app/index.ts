import type { App } from '@cella/org-ui'
import Time from './blocks/Time.svelte'

// The graft's client side: how the work share's portion by time worked
// would divide, member by member, on the allocation's page.
export const app: App = {
  name: 'account-timesheet',
  extends: {
    allocations: { page: { blocks: [Time] } },
  },
}
