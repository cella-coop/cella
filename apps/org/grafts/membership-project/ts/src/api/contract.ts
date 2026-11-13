import type { Query } from '@cella/org-db'

// The views the membership-project graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  shares: {
    view: 'membership_project.shares',
    published: true,
    by: [],
    columns: ['id', 'project', 'member', 'amount', 'granted', 'circle'],
    order: [],
  },
}
