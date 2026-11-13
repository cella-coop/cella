import type { Query } from '@cella/org-db'

// The views the account feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  chart: {
    view: 'account.chart',
    published: true,
    by: [],
    columns: ['code', 'label', 'kind', 'parent', 'cash', 'frozen', 'circle'],
    order: [],
  },
  periods: {
    view: 'account.periods',
    published: true,
    by: [],
    columns: ['month', 'closed', 'since', 'until', 'circle'],
    order: [],
  },
  rubrics: {
    view: 'account.rubrics',
    published: true,
    by: [],
    columns: ['id', 'sheet', 'n', 'kind', 'label', 'side', 'prefixes', 'adds', 'subtracts'],
    order: ['id'],
  },
  capital_terms: {
    view: 'account.capital_terms',
    published: true,
    by: [],
    columns: ['id', 'policy', 'from', 'share', 'minimum', 'instalments', 'delay', 'repayments', 'adopted', 'circle'],
    order: [],
  },
  spans: {
    view: 'account.spans',
    published: true,
    by: [],
    columns: ['id', 'kind', 'since', 'until', 'before', 'before_since', 'before_until', 'closed'],
    order: ['kind', 'since'],
  },
  placements: {
    view: 'account.placements',
    published: true,
    by: [],
    columns: ['sheet', 'code', 'rubric', 'circle'],
    order: [],
  },
  totals: {
    view: 'account.totals',
    published: true,
    by: [],
    columns: ['sheet', 'total', 'line', 'sign'],
    order: ['sheet', 'total', 'line'],
  },
}
