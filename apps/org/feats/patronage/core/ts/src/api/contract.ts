import type { Query } from '@cella/org-db'

// The views the patronage feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  distributions: {
    view: 'patronage.distributions',
    published: true,
    by: [],
    columns: ['id', 'year', 'surplus', 'basis', 'approved', 'distributed', 'circle'],
    order: [],
  },
  shares: {
    view: 'patronage.shares',
    published: true,
    by: [],
    columns: ['distribution', 'kind', 'percent', 'amount', 'circle'],
    order: [],
  },
  terms_adopted: {
    view: 'patronage.terms_adopted',
    published: true,
    by: [],
    columns: ['id', 'from', 'salary', 'hours', 'equal', 'capital', 'interest', 'adopted', 'circle'],
    order: [],
  },
  parts: {
    view: 'patronage.parts',
    published: true,
    by: [],
    columns: ['distribution', 'basis', 'workers', 'quantity', 'amount'],
    order: ['distribution', 'basis'],
  },
}
