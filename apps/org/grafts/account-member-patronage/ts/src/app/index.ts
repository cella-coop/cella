import type { App } from '@cella/org-ui'
import type { Named } from '../models/split.ts'
import Shares from './blocks/Shares.svelte'

// The graft's client side: whose a statement is, and, on a member's page,
// how the work share divides and what of it buys an associate shares.
export const app: App = {
  name: 'account-member-patronage',
  extends: {
    statements: {
      page: {
        properties: (m: Named | null) => (m ? [{ label: 'Member', value: m.name, href: `/members/${m.member}` }] : []),
      },
    },
    members: {
      page: {
        blocks: [{ tab: 'rights', block: Shares }],
      },
    },
  },
}
