import type { Query } from '@cella/org-db'

// The views the task feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  tasks: {
    view: 'task.tasks',
    published: true,
    by: [],
    columns: ['id', 'title', 'status', 'priority', 'due', 'created', 'completed', 'circle'],
    personal: ['title'],
    order: [],
  },
}
