import type { Query } from '@cella/org-db'

// The views the account-membership-transaction graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  capital_months: {
    view: 'account_membership_transaction.capital_months',
    published: true,
    by: [],
    columns: ['month', 'subscribed', 'paid', 'drawn', 'repaid'],
    order: ['month'],
  },
}
