import { date, icons, type App, type Tone } from '@cella/org-ui'
import type { Detail, Meeting, Status } from '../models/meeting.ts'
import Agenda from './blocks/Agenda.svelte'
import Create from './blocks/Create.svelte'
import Settle from './blocks/Settle.svelte'

const tones: Record<Status, Tone> = { scheduled: 'accent', held: 'positive', cancelled: 'neutral' }

// A meeting's day and time, as people say it.
export const when = (m: Meeting) => `${date(m.at)}, ${m.at.slice(11, 16)}`

// The feat's client side: the meetings on a calendar by the day they
// meet, a new one, and a meeting's page, holding or cancelling it: its
// content first, which the minutes' graft fills, and its agenda in a
// tab after it, reordered by dragging.
export const app: App = {
  name: 'meeting',
  collections: {
    meetings: {
      view: {
        group: 'office',
        title: 'Meetings',
        caption: 'Circles meeting: their agendas, who came, and their minutes',
        icon: icons.ChatsCircle,
        create: Create,
        columns: [
          { key: 'title', label: 'Meeting', kind: 'title', role: 'title', value: (m: Meeting) => m.title },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'sub', value: (m: Meeting) => m.circle },
          { key: 'at', label: 'When', kind: 'date', role: 'meta', value: (m: Meeting) => m.at },
          { key: 'place', label: 'Place', role: 'hidden', value: (m: Meeting) => m.place },
          { key: 'items', label: 'Items', kind: 'number', role: 'hidden', value: (m: Meeting) => m.items },
          { key: 'length', label: 'Minutes', kind: 'number', role: 'hidden', value: (m: Meeting) => m.length },
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (m: Meeting) => m.status, tone: (m: Meeting) => tones[m.status] },
        ],
        look: { layout: 'calendar', on: 'at', span: 'month', cards: ['circle', 'place', 'status'], lanes: { status: ['scheduled', 'held', 'cancelled'] } },
      },
      page: {
        eyebrow: 'Meeting',
        title: (m: Detail) => m.title,
        subtitle: (m: Detail) => m.id,
        properties: (m: Detail) => [
          { label: 'Status', value: m.status, kind: 'badge', tone: tones[m.status] },
          { label: 'Circle', value: m.circle },
          { label: 'When', value: when(m) },
          { label: 'Place', value: m.place || null },
          ...(m.link ? [{ label: 'Link', value: m.link.replace(/^https:\/\//, '').split('/')[0], href: m.link }] : []),
          { label: 'Agenda', value: m.length ? `${m.items} items, ${m.length} min` : `${m.items} items` },
        ],
        activity: (m: Detail) => [
          ...(m.minuted ? [{ at: m.minuted, text: 'minutes begun' }] : []),
          ...(m.settled ? [{ at: m.settled, text: m.status }] : []),
          ...(m.scheduled ? [{ at: m.scheduled, text: 'scheduled' }] : []),
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'agenda', label: 'Agenda' },
        ],
        blocks: [{ tab: 'agenda', block: Agenda }],
        actions: Settle,
      },
    },
  },
}
export * as circles from './circles.ts'
