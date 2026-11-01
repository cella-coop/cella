import { date, type App, type Embed } from '@cella/org-ui'
import type { OnMeeting, Sitting } from '../models/tabled.ts'
import { Card } from '@cella/org-motion/app'
import Tabled from './blocks/Tabled.svelte'

// A motion drawn inside a meeting's minutes where the meeting's page
// reads them: the minutes' graft knows motions only as embeds.
const motion: Embed<OnMeeting> = { label: 'Motion', block: Card }

// The graft's client side: under a meeting's agenda the motions it
// tables and where each stands, and tabling one; on a motion's page,
// the meetings it is tabled at.
export const app: App = {
  name: 'meeting-motion',
  extends: {
    meetings: {
      page: {
        related: (d: OnMeeting) => d.tabled.map((t) => ({ label: t.name, sub: t.motion, href: `/motions/${t.motion}` })),
        blocks: [{ tab: 'agenda', block: Tabled }],
        embeds: { motion },
      },
    },
    motions: {
      page: {
        related: (s: Sitting[]) => s.map((m) => ({ label: m.title, sub: `${date(m.at)}, ${m.status}`, href: `/meetings/${m.meeting}` })),
      },
    },
  },
}
