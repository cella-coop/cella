import type { Query } from '@cella/org-db'

// The views the person core feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  people: {
    view: 'person.people',
    published: true,
    by: [],
    columns: ['address', 'name', 'circle'],
    personal: ['name'],
    order: [],
  },
}
