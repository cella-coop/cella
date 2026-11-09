import type { App } from '@cella/org-ui'
import type { Held, Seat } from '@cella/org-circle/models'
import Circles from './blocks/Circles.svelte'
import Decides from './blocks/Decides.svelte'
import Members from './blocks/Members.svelte'
import Powers from './blocks/Powers.svelte'
import Seats from './blocks/Seats.svelte'

// The feat's seats, client side: a circle's seats, and a member's seats and the
// mandates they hold through them; every power they hold and by what, on
// its own tab; the circles joining asks, and what a member decides, read
// back as sentences.
export const app: App = {
  name: 'membership/seats',
  extends: {
    circles: {
      columns: [{ key: 'seated', label: 'Seated', kind: 'number', role: 'meta', value: (r: { seated?: number }) => r.seated ?? 0 }],
      look: { cards: ['purpose', 'parent', 'seated'] },
      page: {
        properties: (s: Seat[]) => [{ label: 'Seated', value: new Set(s.filter((x) => !x.until).map((x) => x.member)).size, kind: 'number' }],
        tabs: [{ id: 'seats', label: 'Seats' }],
        blocks: [{ tab: 'seats', block: Members }],
      },
    },
    people: {
      columns: [{ key: 'circles', label: 'Circles', kind: 'mono', role: 'hidden', value: (r: { circles?: string }) => r.circles }],
      page: {
        related: (d: { seats: Seat[]; held: Held[] }) =>
          d.seats.filter((s) => !s.until).map((s) => ({ label: s.circleName, sub: s.roleName ?? undefined, href: `/circles/${s.circle}` })),
        tabs: [{ id: 'powers', label: 'Powers' }],
        blocks: [Seats, { tab: 'joining', block: Circles }, { tab: 'rights', block: Decides }, { tab: 'powers', block: Powers }],
      },
    },
  },
}
