import { date, type App } from '@cella/org-ui'
import type { Attended } from '../models/attendance.ts'

// The graft's client side: how many came to each meeting, and on a
// member's page the meetings they were marked at. Who was expected and
// the attendance block are circle-meeting-member's, which knows the
// seats.
export const app: App = {
  name: 'meeting-member',
  extends: {
    meetings: {
      columns: [{ key: 'present', label: 'Present', kind: 'number', role: 'hidden', value: (r: { present?: number }) => r.present ?? null }],
    },
    members: {
      page: {
        related: (a: Attended[]) =>
          a.slice(0, 6).map((m) => ({ label: m.title, sub: `${date(m.at)}, ${m.status}`, href: `/meetings/${m.meeting}` })),
      },
    },
  },
}
