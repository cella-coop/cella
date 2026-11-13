import type { Query } from '@cella/org-db'

// The views the meeting-membership graft publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  attendance_marked: {
    view: 'meeting_membership.attendance_marked',
    published: true,
    by: [],
    columns: ['meeting', 'member', 'status', 'marked', 'circle'],
    order: [],
  },
}
