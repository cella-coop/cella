import type { App } from '@cella/org-ui'
import type { Posted } from '../models/posted.ts'
import Distribute from './blocks/Distribute.svelte'

// The graft's client side: the entry that posted a distribution, and
// distributing an approved split whose posting was refused.
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
