import type { Query } from '@cella/org-db'

// The views the bill feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  bills: {
    view: 'bill.bills',
    published: true,
    by: [],
    columns: ['id', 'supplier', 'reference', 'issued', 'due', 'category', 'net', 'vat', 'total', 'status', 'recorded', 'approved', 'paid', 'circle'],
    order: [],
  },
  taxes: {
    view: 'bill.taxes',
    published: true,
    by: [],
    columns: ['bill', 'rate', 'base', 'tax', 'circle'],
    order: [],
  },
}
