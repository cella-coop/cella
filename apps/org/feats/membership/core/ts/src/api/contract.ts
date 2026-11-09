import type { Query } from '@cella/org-db'

// The views the membership feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  members: {
    view: 'membership.members',
    published: true,
    by: [],
    columns: ['address', 'status', 'since', 'shares', 'invited', 'suspended', 'exited', 'circle'],
    order: [],
  },
}
