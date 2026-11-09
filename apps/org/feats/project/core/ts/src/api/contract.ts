import type { Query } from '@cella/org-db'

// The views the project feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  projects: {
    view: 'project.projects',
    published: true,
    by: [],
    columns: ['id', 'title', 'circle', 'started', 'due', 'budget', 'archived'],
    order: [],
  },
  milestones: {
    view: 'project.milestones',
    published: true,
    by: [],
    columns: ['project', 'n', 'title', 'due', 'completed', 'circle'],
    order: [],
  },
}
