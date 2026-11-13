import type { App } from '@cella/org-ui'
import Months from './blocks/Months.svelte'

// The graft's client side: whose each entry is, and the hours by worker
// on the timesheets' dashboard; a worker's months in their Employment tab, with
// submitting and approving them.
export const app: App = {
  name: 'employment-timesheet',
  extends: {
    timesheets: {
      columns: [{ key: 'who', label: 'Worker', kind: 'badge', role: 'sub', record: 'people', value: (r: { who?: string }) => r.who }],
      dashboard: [{ kind: 'chart', title: 'Hours by worker', measure: { op: 'sum', field: 'hours' }, by: 'who' }],
    },
    people: {
      page: { blocks: [{ tab: 'employment', block: Months }] },
    },
  },
}
