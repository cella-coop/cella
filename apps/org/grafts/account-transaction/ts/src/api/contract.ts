import type { Query } from '@cella/org-db'

// The views the account-transaction graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  movements: {
    view: 'account_transaction.movements',
    published: true,
    by: [],
    columns: ['code', 'day', 'month', 'debit', 'credit'],
    order: ['code', 'day'],
  },
}
