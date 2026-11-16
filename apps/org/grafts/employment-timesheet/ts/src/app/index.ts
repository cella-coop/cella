import type { App } from '@cella/org-ui'
import Months from './blocks/Months.svelte'

// The graft's client side: whose each entry is, and the hours by worker
// on the timesheets' dashboard; a worker's months in their Work tab, with
// submitting and approving them.
export const app: App = {
  name: 'employment-timesheet',
  extends: {
    timesheets: {
      // The worker's name, which charts by worker; the row shows the worker
      // as a person, the timesheet's own column.
      columns: [{ key: 'who', label: 'Worker name', kind: 'badge', role: 'hidden', record: 'people', value: (r: { who?: string }) => r.who }],
      look: { hide: ['who'] },
      dashboard: [{ kind: 'chart', title: 'Hours by worker', measure: { op: 'sum', field: 'hours' }, by: 'who' }],
    },
    people: {
      page: { blocks: [{ tab: 'work', block: Months }] },
    },
  },
}
