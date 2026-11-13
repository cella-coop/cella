import type { Query } from '@cella/org-db'

// The views the invoice-project graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  charges: {
    view: 'invoice_project.charges',
    published: true,
    by: [],
    columns: ['invoice', 'project', 'circle'],
    order: [],
  },
  totals: {
    view: 'invoice_project.totals',
    published: true,
    by: [],
    columns: ['project', 'net'],
    order: ['project'],
  },
}
