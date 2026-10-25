import type { App } from '@cella/org-ui'
import type { Posted } from '../models/posted.ts'
import Distribute from './blocks/Distribute.svelte'

// The graft's client side: distributing an approved split from the
// distribution's page, and the entry that posted it.
export const app: App = {
  name: 'patronage-transaction',
  extends: {
    distributions: {
      page: {
        related: (p: Posted) => (p.entry ? [{ label: p.entry, sub: 'posted the split', href: `/transactions/${p.entry}` }] : []),
        actions: Distribute,
      },
    },
  },
}
