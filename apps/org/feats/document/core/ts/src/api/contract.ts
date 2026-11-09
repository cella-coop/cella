import type { Query } from '@cella/org-db'

// The views the document feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  documents: {
    view: 'document.documents',
    published: true,
    by: [],
    columns: ['id', 'title', 'versions', 'saved', 'adopted', 'circle'],
    order: [],
  },
}
