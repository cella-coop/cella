import type { App } from '@cella/org-ui'
import type { Proposing } from '../models/index.ts'
import Put from './blocks/Put.svelte'

// The graft's client side: on a circle's page, proposing a change to its
// place or its powers, and the open decisions about it.
export const app: App = {
  name: 'circle-decision',
  extends: {
    circles: {
      page: {
        properties: (p: Proposing | null) => (p ? [{ label: 'Decided by', value: p.decider.name, href: `/circles/${p.decider.id}` }] : []),
        related: (p: Proposing | null) => (p?.open ?? []).map((o) => ({ label: o.title, sub: `open until ${o.deadline}`, href: `/decisions/${o.decision}` })),
        actions: Put,
      },
    },
  },
}
