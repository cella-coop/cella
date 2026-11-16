import type { App } from '@cella/org-ui'
import type { Claimed } from '../models/claim.ts'

// The graft's client side: whose each expense is, on the board's cards and
// the expense's page; a member's expenses are a jump in their page's
// Related.
export const app: App = {
  name: 'expense-membership',
  extends: {
    expenses: {
      columns: [{ key: 'name', label: 'Member', role: 'hidden', value: (r: Partial<Claimed>) => r.name ?? '' }],
      look: { cards: ['name', 'total', 'day'] },
      page: {
        properties: (c: Claimed | null) => [
          { label: 'Claimed by', value: c?.name },
          ...(c?.decider_name ? [{ label: 'Decided by', value: c.decider_name }] : []),
        ],
      },
    },
  },
}
