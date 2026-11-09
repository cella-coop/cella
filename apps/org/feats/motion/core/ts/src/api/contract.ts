import type { Query } from '@cella/org-db'

// The views the motion feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  motions: {
    view: 'motion.motions',
    published: true,
    by: [],
    columns: ['id', 'circle', 'title', 'method', 'procedure', 'ballot', 'proposed', 'deadline', 'closed'],
    personal: ['title'],
    order: [],
  },
  procedures: {
    view: 'motion.procedures',
    published: true,
    by: [],
    columns: ['id', 'label', 'method', 'share_num', 'share_den', 'quorum_num', 'quorum_den', 'ballot'],
    order: ['id'],
  },
}
