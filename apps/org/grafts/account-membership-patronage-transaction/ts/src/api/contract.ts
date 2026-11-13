import type { Query } from '@cella/org-db'

// The views the account-membership-patronage-transaction graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  credits: {
    view: 'account_membership_patronage_transaction.credits',
    published: true,
    by: [],
    columns: ['distribution', 'members', 'shares', 'amount', 'until'],
    order: ['distribution'],
  },
  posted: {
    view: 'account_membership_patronage_transaction.posted',
    published: true,
    by: [],
    columns: ['distribution', 'code', 'debit', 'credit'],
    order: ['distribution', 'code'],
  },
}
