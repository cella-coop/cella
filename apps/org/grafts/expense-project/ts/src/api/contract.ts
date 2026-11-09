import type { Query } from '@cella/org-db'

// The views the expense-project graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  rebills: {
    view: 'expense_project.rebills',
    published: true,
    by: [],
    columns: ['expense', 'project', 'circle'],
    order: [],
  },
  totals: {
    view: 'expense_project.totals',
    published: true,
    by: [],
    columns: ['project', 'expenses', 'approved', 'pending'],
    order: ['project'],
  },
}
