import type { App } from '@cella/org-ui'
import type { Burn, Time as Spent } from '../models/booking.ts'
import Time from './blocks/Time.svelte'

// The graft's client side: each entry's project, and the hours by project
// on the timesheets' dashboard; what each project's time spent of its
// budget; and on a project's page, its own tab of time, a table by member
// and entry the overview has no room for, with logging time against it.
export const app: App = {
  name: 'project-timesheet',
  extends: {
    timesheets: {
      columns: [{ key: 'project', label: 'Project', kind: 'badge', role: 'meta', record: 'projects', value: (r: { project?: string }) => r.project }],
      dashboard: [{ kind: 'chart', title: 'Hours by project', measure: { op: 'sum', field: 'hours' }, by: 'project' }],
    },
    projects: {
      columns: [
        { key: 'hours', label: 'Hours', kind: 'number', role: 'hidden', value: (r: Burn) => r.hours },
        { key: 'used', label: 'Spent', kind: 'money', role: 'hidden', value: (r: Burn) => r.used },
      ],
      page: {
        properties: (t: Spent) => [
          { label: 'Hours', value: t.hours, kind: 'number' },
          { label: 'Spent', value: t.spent, kind: 'money' },
        ],
        tabs: [{ id: 'time', label: 'Time' }],
        blocks: [{ tab: 'time', block: Time }],
      },
    },
  },
}
