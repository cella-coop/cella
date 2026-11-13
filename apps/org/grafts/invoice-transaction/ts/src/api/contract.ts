import type { Query } from '@cella/org-db'

// The views the invoice-transaction graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  postings: {
    view: 'invoice_transaction.postings',
    published: true,
    by: [],
    columns: ['entry', 'invoice', 'event', 'payment', 'circle'],
    order: [],
  },
}
