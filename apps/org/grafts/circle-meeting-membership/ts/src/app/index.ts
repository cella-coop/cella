import type { App } from '@cella/org-ui'
import type { OnMeeting } from '../models/roll.ts'
import Attendance from './blocks/Attendance.svelte'

// The graft's client side: on a meeting's page, whether it is quorate,
// and under its agenda who is expected and who came, marking oneself and
// recording others.
export const app: App = {
  name: 'circle-meeting-membership',
  extends: {
    meetings: {
      columns: [{ key: 'quorate', label: 'Seats present', role: 'hidden', value: (r: { quorate?: string }) => r.quorate ?? null }],
      page: {
        properties: (m: OnMeeting | null) =>
          m
            ? [
                {
                  label: 'Present',
                  value: `${m.quorum.present} of ${m.quorum.seats}, ${m.quorum.needed} needed`,
                  kind: 'badge' as const,
                  tone: m.quorum.present >= m.quorum.needed ? ('positive' as const) : ('warning' as const),
                },
              ]
            : [],
        blocks: [{ tab: 'agenda', block: Attendance }],
      },
    },
  },
}
