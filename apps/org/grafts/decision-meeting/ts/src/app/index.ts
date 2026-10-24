import { date, type App, type Embed } from '@cella/org-ui'
import type { OnMeeting, Sitting } from '../models/tabled.ts'
import Card from './blocks/Card.svelte'
import Tabled from './blocks/Tabled.svelte'

// A decision drawn inside a meeting's minutes where the meeting's page
// reads them: the minutes' graft knows decisions only as embeds.
const decision: Embed<OnMeeting> = { label: 'Decision', block: Card }

// The graft's client side: under a meeting's agenda the decisions it
// tables and where each stands, and tabling one; on a decision's page,
// the meetings it is tabled at.
export const app: App = {
  name: 'decision-meeting',
  extends: {
    meetings: {
      page: {
        related: (d: OnMeeting) => d.tabled.map((t) => ({ label: t.name, sub: t.decision, href: `/decisions/${t.decision}` })),
        blocks: [{ tab: 'agenda', block: Tabled }],
        embeds: { decision },
      },
    },
    decisions: {
      page: {
        related: (s: Sitting[]) => s.map((m) => ({ label: m.title, sub: `${date(m.at)}, ${m.status}`, href: `/meetings/${m.meeting}` })),
      },
    },
  },
}
