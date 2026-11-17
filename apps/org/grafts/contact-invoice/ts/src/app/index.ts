import type { App } from '@cella/org-ui'
import type { Bill, Billed, Owing } from '../models/billing.ts'
import Bills from './blocks/Bills.svelte'

// The graft's client side: the contact an invoice bills and the popover that
// links it, and what a contact owes and, in its Invoices tab, the
// invoices that bill it.
export const app: App = {
  name: 'contact-invoice',
  extends: {
    invoices: {
      columns: [{ key: 'contact', label: 'Client', role: 'hidden', value: (r: { contact?: string }) => r.contact }],
      page: {
        properties: (b: Billed) => [
          {
            label: 'Client',
            value: b.contact?.name ?? null,
            href: b.contact ? `/contacts/${b.contact.id}` : undefined,
            edit: { kind: 'pick' as const, write: 'link', field: 'contact', current: b.contact?.id ?? '', options: b.contacts.map((c) => ({ value: c.id, label: c.name })) },
          },
        ],
        related: (b: Billed) => (b.contact ? [{ label: b.contact.name, sub: 'client', href: `/contacts/${b.contact.id}` }] : []),
      },
    },
    contacts: {
      columns: [
        { key: 'owed', label: 'Owes', kind: 'money', role: 'meta', value: (r: Partial<Owing>) => r.owed ?? 0 },
        { key: 'credit', label: 'Credit', kind: 'money', role: 'hidden', value: (r: Partial<Owing>) => r.credit ?? 0 },
      ],
      page: {
        properties: (b: Bill[]) => [{ label: 'Owes', value: b.reduce((s, x) => s + x.owed, 0), kind: 'money' }],
        blocks: [{ tab: 'invoices', block: Bills }],
      },
    },
  },
}
