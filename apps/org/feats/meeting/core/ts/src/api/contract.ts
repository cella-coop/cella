import type { Query } from '@cella/org-db'

// The views the meeting feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  meetings: {
    view: 'meeting.meetings',
    published: true,
    by: [],
    columns: ['id', 'circle', 'title', 'status', 'scheduled', 'day', 'settled', 'minuted'],
    order: [],
  },
  items: {
    view: 'meeting.items',
    published: true,
    by: [],
    columns: ['id', 'meeting', 'title', 'minutes', 'circle'],
    order: [],
  },
}
