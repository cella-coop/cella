import type { Query } from '@cella/org-db'

// The views the timesheet feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  months: {
    view: 'timesheet.months',
    published: true,
    by: [],
    columns: ['month', 'entries', 'members', 'minutes', 'billable'],
    order: ['month'],
  },
}
