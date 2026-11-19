import type { App } from '@cella/org-ui'
import type { Burn, Time as Spent } from '../models/booking.ts'
import Time from './blocks/Time.svelte'

// The graft's client side: each entry's project, and the hours by project
// on the timesheets' dashboard; what each project's time spent of its
// budget; and on a project's Budget tab, its time, a table by member and
// entry the overview has no room for, with logging time against it.
export const app: App = {
  name: 'project-timesheet',
  extends: {
    timesheets: {
      columns: [
        { key: 'project', label: 'Project', kind: 'badge', role: 'meta', record: 'projects', value: (r: { project?: string }) => r.project },
        { key: 'project_id', label: 'Project id', kind: 'mono', role: 'hidden', of: 'projects', value: (r: { project_id?: string }) => r.project_id },
      ],
      dashboard: [{ kind: 'chart', title: 'Hours by project', measure: { op: 'sum', field: 'hours' }, by: 'project' }],
    },
    projects: {
      columns: [
        { key: 'hours', label: 'Hours', kind: 'number', role: 'hidden', value: (r: Burn) => r.hours },
        { key: 'used', label: 'Spent', kind: 'money', role: 'hidden', value: (r: Burn) => r.used },
      ],
      page: {
        figures: (t: Spent) => [
          { label: 'Hours', value: t.hours, kind: 'number' },
          { label: 'Spent', value: t.spent, kind: 'money' },
        ],
        blocks: [{ tab: 'budget', block: Time }],
      },
    },
  },
}
