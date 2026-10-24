import type { App } from '@cella/org-ui'
import type { Held, Seat } from '../models/position.ts'
import Members from './blocks/Members.svelte'
import Seats from './blocks/Seats.svelte'

// The graft's client side: a circle's seats, and a member's seats and the
// mandates they hold through them.
export const app: App = {
  name: 'circle-member',
  extends: {
    circles: {
      columns: [{ key: 'seated', label: 'Seated', kind: 'number', role: 'meta', value: (r: { seated?: number }) => r.seated ?? 0 }],
      page: {
        properties: (s: Seat[]) => [{ label: 'Seated', value: new Set(s.filter((x) => !x.until).map((x) => x.member)).size, kind: 'number' }],
        blocks: [Members],
      },
    },
    members: {
      columns: [{ key: 'circles', label: 'Circles', kind: 'mono', role: 'hidden', value: (r: { circles?: string }) => r.circles }],
      page: {
        related: (d: { seats: Seat[]; held: Held[] }) =>
          d.seats.filter((s) => !s.until).map((s) => ({ label: s.circleName, sub: s.roleName ?? undefined, href: `/circles/${s.circle}` })),
        blocks: [Seats],
      },
    },
  },
}
