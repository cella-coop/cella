import type { App } from '@cella/org-ui'
import type { Proposing } from '../models/index.ts'
import Policies from './blocks/Policies.svelte'
import Put from './blocks/Put.svelte'

// The graft's client side: on a circle's page, proposing a change to its
// place or its powers, the open motions about it, and its policies in
// force.
export const app: App = {
  name: 'circle-motion',
  extends: {
    circles: {
      page: {
        properties: (p: Proposing | null) => (p ? [{ label: 'Decided by', value: p.decider.name, href: `/circles/${p.decider.id}` }] : []),
        related: (p: Proposing | null) => (p?.open ?? []).map((o) => ({ label: o.title, sub: `open until ${o.deadline}`, href: `/motions/${o.motion}` })),
        blocks: [Policies],
        actions: Put,
      },
    },
  },
}
