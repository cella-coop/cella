import type { Query } from '@cella/org-db'

// The views the invoice feat publishes in its analytical contract,
// `sql/analytics.sql`, each a query of its own: the analytics shell
// reads it, and the web shell serves it through the port (architecture.md,
// "Analytical contracts").
export const contract: Record<string, Query> = {
  invoices: {
    view: 'invoice.invoices',
    published: true,
    by: [],
    columns: ['id', 'series', 'number', 'issued', 'due', 'net', 'vat', 'total', 'sent', 'voided', 'paid', 'owed', 'credit', 'state', 'circle'],
    order: [],
  },
  taxes: {
    view: 'invoice.taxes',
    published: true,
    by: [],
    columns: ['invoice', 'rate', 'base', 'tax', 'circle'],
    order: [],
  },
  payments: {
    view: 'invoice.payments',
    published: true,
    by: [],
    columns: ['id', 'invoice', 'at', 'amount', 'method', 'circle'],
    order: [],
  },
}
