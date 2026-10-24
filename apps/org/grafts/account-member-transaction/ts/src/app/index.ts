import type { App } from '@cella/org-ui'
import type { Account } from '../models/draw.ts'
import Draws from './blocks/Draws.svelte'

// The graft's client side: a member's capital in the books and their
// draws, on their page, and the entry that subscribed it.
export const app: App = {
  name: 'account-member-transaction',
  extends: {
    members: {
      page: {
        related: (a: Account) => (a.subscribed ? [{ label: a.subscribed, sub: 'subscribed the capital', href: `/transactions/${a.subscribed}` }] : []),
        blocks: [Draws],
      },
    },
  },
}
