import type { App } from '@cella/org-ui'
import type { Held, Seat } from '@cella/org-circle/models'
import Circles from './blocks/Circles.svelte'
import Decides from './blocks/Decides.svelte'
import Members from './blocks/Members.svelte'
import Powers from './blocks/Powers.svelte'
import Seats from './blocks/Seats.svelte'

// The feat's seats, client side: a circle's seats, on its Roles tab; and on
// a member's Authority tab their seats and the mandates they hold through
// them, and every power they hold and by what; on their Membership tab
// the circles joining asks, and what a member decides, read back as
// sentences.
export const app: App = {
  name: 'membership/seats',
  extends: {
    circles: {
      columns: [{ key: 'seated', label: 'Seated', kind: 'number', role: 'meta', value: (r: { seated?: number }) => r.seated ?? 0 }],
      look: { cards: ['purpose', 'seated'] },
      // Its seats are its Roles tab's, counted on its card; its overview
      // counts none, which its Roles panel summarises.
      page: {
        blocks: [{ tab: 'roles', block: Members }],
      },
    },
    people: {
      columns: [{ key: 'circles', label: 'Circles', kind: 'mono', role: 'meta', value: (r: { circles?: string }) => r.circles }],
      page: {
        related: (d: { seats: Seat[]; held: Held[] }) =>
          d.seats.filter((s) => !s.until).map((s) => ({ label: s.circleName, sub: s.roleName ?? undefined, href: `/circles/${s.circle}` })),
        blocks: [{ tab: 'authority', block: Seats }, { tab: 'membership', block: Circles }, { tab: 'membership', block: Decides }, { tab: 'authority', block: Powers }],
      },
    },
  },
}
