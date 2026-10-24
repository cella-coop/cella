import type { App } from '@cella/org-ui'
import type { Claimed } from '../models/claim.ts'
import Expenses from './blocks/Expenses.svelte'

// The graft's client side: whose each expense is, on the board's cards and
// the expense's page, and a member's expenses on theirs.
export const app: App = {
  name: 'expense-member',
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
    members: {
      page: { blocks: [Expenses] },
    },
  },
}
