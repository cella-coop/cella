import type { App } from '@cella/org-ui'
import type { Proposing } from '../models/circles.ts'
import Mandates from './blocks/Mandates.svelte'
import OpenBooks from './blocks/OpenBooks.svelte'
import Policies from './blocks/Policies.svelte'
import Put from './blocks/Put.svelte'
import Revise from './blocks/Revise.svelte'

// The feat's circles, client side: on a circle's page, proposing to
// grant, change or revoke a mandate, the open motions about it, its
// policies in force and, on the assembly's, open books' disclosure
// values; on a mandate's page, changing or revoking it; on a motion's
// page, what its actions do to the mandates.
export const app: App = {
  name: 'motion/circles',
  extends: {
    circles: {
      page: {
        properties: (p: Proposing | null) => (p ? [{ label: 'Decided by', value: p.decider.name, href: `/circles/${p.decider.id}` }] : []),
        related: (p: Proposing | null) => (p?.open ?? []).map((o) => ({ label: o.title, sub: `open until ${o.deadline}`, href: `/motions/${o.motion}` })),
        blocks: [
          { tab: 'policies', block: Policies },
          { tab: 'policies', block: OpenBooks },
        ],
        actions: Put,
      },
    },
    mandates: {
      page: {
        actions: Revise,
      },
    },
    motions: {
      page: {
        blocks: [{ tab: 'effects', block: Mandates }],
      },
    },
  },
}
