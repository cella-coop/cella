import type { App } from '@cella/org-ui'
import Months from './blocks/Months.svelte'

// The graft's client side: whose each entry is, and the hours by member
// on the timesheets' dashboard; a member's months on their page, with
// submitting and approving them.
export const app: App = {
  name: 'member-timesheet',
  extends: {
    timesheets: {
      columns: [{ key: 'who', label: 'Member', kind: 'badge', role: 'sub', value: (r: { who?: string }) => r.who }],
      dashboard: [{ kind: 'chart', title: 'Hours by member', measure: { op: 'sum', field: 'hours' }, by: 'who' }],
    },
    members: {
      page: { blocks: [Months] },
    },
  },
}
