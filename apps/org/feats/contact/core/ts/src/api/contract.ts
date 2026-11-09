import type { Query } from '@cella/org-db'

// The views the contact feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  contacts: {
    view: 'contact.contacts',
    published: true,
    by: [],
    columns: ['id', 'kind', 'person', 'name', 'form', 'parent', 'tags', 'client', 'archived', 'circle'],
    personal: ['name'],
    order: [],
  },
}
