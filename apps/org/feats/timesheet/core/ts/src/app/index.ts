import { date, icons, type App, type Tone } from '@cella/org-ui'
import type { Detail, Entry, Listed, State } from '../models/timesheet.ts'
import Log from './blocks/Log.svelte'
import Period from './blocks/Period.svelte'
import Sheet from './blocks/Sheet.svelte'
import { Body } from '@cella/org-body/app'

const tones: Record<State, Tone> = { open: 'neutral', submitted: 'accent', approved: 'positive' }
const kind = (e: Entry) => (e.billable ? 'billable' : 'internal')

// The feat's client side: every entry in a table; logging time as the acting member; and an entry's page, titled
// by its note, which opens on its member's month, submitted or approved
// from its header, then its notes.
export const app: App = {
  name: 'timesheet',
  collections: {
    timesheets: {
      view: {
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
          { key: 'member', label: 'Worker', kind: 'person', role: 'sub', value: (e: Listed) => e.member },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (e: Listed) => e.circle },
        ],
        // The approval queue: grouped by where each month stands, the
        // latest day first; the month and the circle stay in the drawer.
        look: { layout: 'table', by: 'state', sort: { field: 'day', dir: 'desc' }, hide: ['month', 'circle'], lanes: { state: ['open', 'submitted', 'approved'] } },
      },
      page: {
        eyebrow: 'Time entry',
        title: (e: Detail) => e.note || `${e.hours} h on ${date(e.day)}`,
        subtitle: (e: Detail) => e.id,
        properties: (e: Detail) => [
          { label: 'Timesheet', value: e.state, kind: 'badge', tone: tones[e.state], lead: 'timesheet' },
          { label: 'Kind', value: kind(e), kind: 'badge' },
          { label: 'Day', value: e.day, kind: 'date', lead: 'worked' },
          { label: 'Member', value: e.member, kind: 'person', href: `/people/${e.member}` },
        ],
        figures: (e: Detail) => [{ label: 'Hours', value: e.hours, kind: 'number' }],
        layout: 'panels',
        body: Body,
        blocks: [Period],
        actions: Sheet,
      },
    },
  },
}
