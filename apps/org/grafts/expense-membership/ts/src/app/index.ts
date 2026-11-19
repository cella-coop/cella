import type { App } from '@cella/org-ui'
import type { Claimed } from '../models/claim.ts'

// The graft's client side: whose each expense is, by name, on the board's
// cards; the expense's page names its member and who decided it as
// people, the feat's own, and a member's expenses are a jump in their
// page's Related.
export const app: App = {
  name: 'expense-membership',
  extends: {
    expenses: {
      // The claimant's name, which the text filter finds; the card shows
      // the member as a person, the expense's own column.
      columns: [{ key: 'name', label: 'Claimed by', role: 'hidden', value: (r: Partial<Claimed>) => r.name ?? '' }],
    },
  },
}
