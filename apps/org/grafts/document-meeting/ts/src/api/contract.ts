import type { Query } from '@cella/org-db'

// The views the document-meeting graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  minuted: {
    view: 'document_meeting.minuted',
    published: true,
    by: [],
    columns: ['meeting', 'document', 'circle'],
    order: [],
  },
}
