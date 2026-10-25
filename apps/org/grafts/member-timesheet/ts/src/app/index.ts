import type { App } from '@cella/org-ui'
import Months from './blocks/Months.svelte'

// The graft's client side: a member's months on their page, with
// submitting and approving them. Whose each entry is, and the hours by
// worker on the dashboard, are timesheet-worker's.
export const app: App = {
  name: 'member-timesheet',
  extends: {
    members: {
      page: { blocks: [Months] },
    },
  },
}
