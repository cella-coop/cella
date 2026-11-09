import type { Query } from '@cella/org-db'

// The views the employment feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  workers: {
    view: 'employment.workers',
    published: true,
    by: [],
    columns: ['address', 'job', 'contract', 'start', 'until', 'minutes', 'hired', 'circle'],
    order: [],
  },
}
