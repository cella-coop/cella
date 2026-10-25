import type { App } from '@cella/org-ui'
import Time from './blocks/Time.svelte'

// The graft's client side: how the work share's portion by time worked
// would divide, member by member, on the distribution's page.
export const app: App = {
  name: 'patronage-timesheet',
  extends: {
    distributions: { page: { blocks: [Time] } },
  },
}
