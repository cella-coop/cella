import type { App } from '@cella/org-ui'
import type { Bill, Billed, Owing } from '../models/billing.ts'
import Bills from './blocks/Bills.svelte'
import Contact from './blocks/Contact.svelte'

// The graft's client side: the contact an invoice bills and the form that
// links it, and what a contact owes and the invoices that bill it.
export const app: App = {
  name: 'contact-invoice',
  extends: {
    invoices: {
      columns: [{ key: 'contact', label: 'Contact', role: 'hidden', value: (r: { contact?: string }) => r.contact }],
      page: {
        properties: (b: Billed) => [{ label: 'Contact', value: b.contact?.name ?? 'unbilled', href: b.contact ? `/contacts/${b.contact.id}` : undefined }],
        related: (b: Billed) => (b.contact ? [{ label: b.contact.name, sub: 'contact', href: `/contacts/${b.contact.id}` }] : []),
        blocks: [Contact],
      },
    },
    contacts: {
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
