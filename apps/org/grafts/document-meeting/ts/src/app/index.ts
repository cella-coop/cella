import { date, type App, type Embed } from '@cella/org-ui'
import type { OnDocument, OnMeeting } from '../models/minutes.ts'
import Card from './blocks/Card.svelte'
import Minutes from './blocks/Minutes.svelte'

// A meeting drawn inside a document: on the minutes' own page, and
// offered by any draft's slash menu.
const meeting: Embed<OnDocument | OnMeeting> = {
  label: 'Meeting',
  block: Card,
  choices: (d) => d.meetings.map((m) => ({ ref: m.id, label: `${m.title}, ${date(m.at)}` })),
}

// Where a meeting's minutes stand: not begun, a draft, or their latest
// version, adopted or not.
const n = (version: string | null) => version?.split('@')[1]
function stands(d: OnMeeting): string {
  const m = d.minutes
  if (!m) {
    return 'not begun'
  }
  if (m.adopted) {
    return `version ${n(m.adopted)}, adopted`
  }
  return m.latest ? `version ${n(m.latest)}` : 'draft'
}

// The graft's client side: a meeting's minutes in a tab of its own, read
// as the document is, and the meeting card the minutes open with; on a
// document's page, the meeting it minutes.
export const app: App = {
  name: 'document-meeting',
  extends: {
    meetings: {
      page: {
        properties: (d: OnMeeting) => [{ label: 'Minutes', value: stands(d), href: d.minutes ? `/documents/${d.minutes.document}` : undefined }],
        tabs: [{ id: 'minutes', label: 'Minutes' }],
        blocks: [{ tab: 'minutes', block: Minutes }],
        embeds: { meeting },
      },
    },
    documents: {
      page: {
        related: (d: OnDocument) => (d.of ? [{ label: d.of.title, sub: `meeting, ${date(d.of.at)}`, href: `/meetings/${d.of.id}` }] : []),
        embeds: { meeting },
      },
    },
  },
}
