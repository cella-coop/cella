import type { App } from '@cella/org-ui'
import type { Bill, Billed, Owing } from '../models/billing.ts'

// The graft's client side: the contact an invoice bills and the popover that
// links it, and what a contact owes and, in its Invoices tab, the
// invoices that bill it, the invoices collection scoped to the contact.
export const app: App = {
  name: 'contact-invoice',
  extends: {
    invoices: {
      columns: [
        { key: 'contact', label: 'Client', role: 'hidden', record: 'contacts', value: (r: { contact?: string }) => r.contact },
        { key: 'contact_id', label: 'Client id', kind: 'mono', role: 'hidden', of: 'contacts', value: (r: { contact_id?: string }) => r.contact_id },
      ],
      page: {
        properties: (b: Billed) => [
          {
            label: 'Client',
            value: b.contact?.name ?? null,
            href: b.contact ? `/contacts/${b.contact.id}` : undefined,
            lead: 'bills',
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
        // What it owes, while it owes anything.
        figures: (b: Bill[]) => {
          const owed = b.reduce((s, x) => s + x.owed, 0)
          return owed ? [{ label: 'Owes', value: owed, kind: 'money' }] : []
        },
        scoped: [{ tab: 'invoices', collection: 'invoices' }],
      },
    },
  },
}
