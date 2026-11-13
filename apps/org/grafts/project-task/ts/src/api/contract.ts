import type { Query } from '@cella/org-db'

// The views the project-task graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  filings: {
    view: 'project_task.filings',
    published: true,
    by: [],
    columns: ['task', 'project', 'milestone', 'circle'],
    order: [],
  },
}
