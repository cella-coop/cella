import type { Query } from '@cella/org-db'

// The views the project-timesheet graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  months: {
    view: 'project_timesheet.months',
    published: true,
    by: [],
    columns: ['project', 'month', 'minutes', 'billable', 'spent', 'cost'],
    order: ['project', 'month'],
  },
  rates: {
    view: 'project_timesheet.rates',
    published: true,
    by: [],
    columns: ['since', 'hourly', 'circle'],
    order: [],
  },
  costs: {
    view: 'project_timesheet.costs',
    published: true,
    by: [],
    columns: ['since', 'hourly', 'circle'],
    order: [],
  },
  forecasts: {
    view: 'project_timesheet.forecasts',
    published: true,
    by: [],
    columns: ['project', 'day', 'budget', 'spent', 'cost', 'burn', 'elapsed', 'forecast'],
    order: ['project'],
  },
}
