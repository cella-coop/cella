import { date, icons, type App, type Tone } from '@cella/org-ui'
import type { Detail, Entry, Listed, State } from '../models/timesheet.ts'
import Log from './blocks/Log.svelte'
import Period from './blocks/Period.svelte'
import Sheet from './blocks/Sheet.svelte'

const tones: Record<State, Tone> = { open: 'neutral', submitted: 'accent', approved: 'positive' }
const kind = (e: Entry) => (e.billable ? 'billable' : 'internal')

// The feat's client side: every entry in a table, with a dashboard of the
// hours; logging time as the acting member; and an entry's page, titled
// by its note, with its member's month in its Month tab, submitted or
// approved from there.
export const app: App = {
  name: 'timesheet',
  collections: {
    timesheets: {
      view: {
        group: 'work',
        title: 'Timesheets',
        caption: 'Time entries by day; each member submits a month, and someone else approves it.',
        icon: icons.Clock,
        create: Log,
        columns: [
          { key: 'note', label: 'Entry', kind: 'title', role: 'title', value: (e: Listed) => e.note },
          { key: 'day', label: 'Day', kind: 'date', role: 'sub', value: (e: Listed) => e.day },
          { key: 'hours', label: 'Hours', kind: 'number', role: 'meta', value: (e: Listed) => e.hours },
          { key: 'billable', label: 'Kind', kind: 'badge', role: 'hidden', value: (e: Listed) => e.billable },
          { key: 'month', label: 'Month', kind: 'badge', role: 'hidden', value: (e: Listed) => e.month },
          { key: 'state', label: 'Timesheet', kind: 'badge', role: 'meta', value: (e: Listed) => e.state, tone: (e: Listed) => tones[e.state] },
        ],
        look: { layout: 'table', lanes: { state: ['open', 'submitted', 'approved'] } },
        dashboard: [
          { kind: 'kpi', title: 'Hours', measure: { op: 'sum', field: 'hours' } },
          { kind: 'kpi', title: 'Billable hours', measure: { op: 'sum', field: 'hours' }, where: [{ field: 'billable', is: ['billable'] }] },
          { kind: 'kpi', title: 'Hours awaiting approval', measure: { op: 'sum', field: 'hours' }, where: [{ field: 'state', is: ['submitted'] }] },
          { kind: 'chart', title: 'Hours by month', measure: { op: 'sum', field: 'hours' }, by: 'day' },
          { kind: 'chart', title: 'Hours by kind', measure: { op: 'sum', field: 'hours' }, by: 'billable' },
        ],
      },
      page: {
        eyebrow: 'Time entry',
        title: (e: Detail) => e.note || `${e.hours} h on ${date(e.day)}`,
        subtitle: (e: Detail) => e.id,
        properties: (e: Detail) => [
          { label: 'Timesheet', value: e.state, kind: 'badge', tone: tones[e.state] },
          { label: 'Hours', value: e.hours, kind: 'number' },
          { label: 'Kind', value: kind(e), kind: 'badge' },
          { label: 'Day', value: e.day, kind: 'date' },
          { label: 'Member', value: e.member, kind: 'person', href: `/people/${e.member}` },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'month', label: 'Month' },
        ],
        blocks: [{ tab: 'month', block: Period }],
        actions: Sheet,
      },
    },
  },
}
