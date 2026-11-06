import type { App } from '@cella/org-ui'
import type { Proposing } from '../models/circles.ts'
import OpenBooks from './blocks/OpenBooks.svelte'
import Policies from './blocks/Policies.svelte'
import Put from './blocks/Put.svelte'

// The feat's circles, client side: on a circle's page, proposing a change to its
// place or its powers, the open motions about it, its policies in
// force and, on the assembly's, open books' disclosure values.
export const app: App = {
  name: 'motion/circles',
  extends: {
    circles: {
      page: {
        properties: (p: Proposing | null) => (p ? [{ label: 'Decided by', value: p.decider.name, href: `/circles/${p.decider.id}` }] : []),
        related: (p: Proposing | null) => (p?.open ?? []).map((o) => ({ label: o.title, sub: `open until ${o.deadline}`, href: `/motions/${o.motion}` })),
        blocks: [Policies, OpenBooks],
        actions: Put,
      },
    },
  },
}
