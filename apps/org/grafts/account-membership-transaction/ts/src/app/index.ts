import type { App } from '@cella/org-ui'
import type { Account } from '../models/draw.ts'
import Draws from './blocks/Draws.svelte'
import Paid from './blocks/Paid.svelte'

// The graft's client side: a member's capital paid in and out and their
// draws, under Own and decide on their page, and the entry that
// subscribed it.
export const app: App = {
  name: 'account-membership-transaction',
  extends: {
    people: {
      page: {
        related: (a: Account) => (a.subscribed ? [{ label: a.subscribed, sub: 'subscribed the capital', href: `/transactions/${a.subscribed}` }] : []),
        blocks: [
          { tab: 'membership', block: Paid },
          { tab: 'membership', block: Draws },
        ],
      },
    },
  },
}
