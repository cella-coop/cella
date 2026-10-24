import type { App } from '@cella/org-ui'
import type { Bill, Billed, Owing } from '../models/billing.ts'
import Bills from './blocks/Bills.svelte'
import Client from './blocks/Client.svelte'

// The graft's client side: the client an invoice bills and the form that
// links it, and what a client owes and the invoices that bill it.
export const app: App = {
  name: 'client-invoice',
  extends: {
    invoices: {
      columns: [{ key: 'client', label: 'Client', role: 'hidden', value: (r: { client?: string }) => r.client }],
      page: {
        properties: (b: Billed) => [{ label: 'Client', value: b.client?.name ?? 'unbilled', href: b.client ? `/clients/${b.client.id}` : undefined }],
        related: (b: Billed) => (b.client ? [{ label: b.client.name, sub: 'client', href: `/clients/${b.client.id}` }] : []),
        blocks: [Client],
      },
    },
    clients: {
      columns: [
        { key: 'owed', label: 'Owes', kind: 'money', role: 'meta', value: (r: Partial<Owing>) => r.owed ?? 0 },
        { key: 'credit', label: 'Credit', kind: 'money', role: 'hidden', value: (r: Partial<Owing>) => r.credit ?? 0 },
      ],
      page: {
        properties: (b: Bill[]) => [{ label: 'Owes', value: b.reduce((s, x) => s + x.owed, 0), kind: 'money' }],
        blocks: [Bills],
      },
    },
  },
}
