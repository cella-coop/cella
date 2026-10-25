import type { App } from '@cella/org-ui'
import type { Account } from '../models/draw.ts'
import type { Employed as Became } from '../models/patronage.ts'
import Draws from './blocks/Draws.svelte'
import Employed from './blocks/Employed.svelte'
import Return from './blocks/Return.svelte'

// The graft's client side: a member's capital in the books and their
// draws, on their page, and the entry that subscribed it; what a worker's
// part of the work share became, on their statement; and a year's return
// to the federation, on the allocation's page.
export const app: App = {
  name: 'account-member-transaction',
  extends: {
    members: {
      page: {
        related: (a: Account) => (a.subscribed ? [{ label: a.subscribed, sub: 'subscribed the capital', href: `/transactions/${a.subscribed}` }] : []),
        blocks: [Draws],
      },
    },
    statements: {
      page: {
        related: (e: Became | null) => (e?.entry ? [{ label: e.entry, sub: 'employed the part in shares', href: `/transactions/${e.entry}` }] : []),
        blocks: [Employed],
      },
    },
    allocations: {
      page: {
        tabs: [{ id: 'return', label: 'Return' }],
        blocks: [{ tab: 'return', block: Return }],
      },
    },
  },
}
