import type { App } from '@cella/org-ui'
import type { For } from '../models/commission.ts'

// The graft's client side: whom a project is for and the popover that links
// it, on its Client property, and the projects a contact commissioned, in
// its Projects tab, the projects collection scoped to the contact.
export const app: App = {
  name: 'contact-project',
  extends: {
    projects: {
      columns: [
        { key: 'contact', label: 'Client', role: 'sub', record: 'contacts', value: (r: { contact?: string }) => r.contact },
        { key: 'contact_id', label: 'Client id', kind: 'mono', role: 'hidden', of: 'contacts', value: (r: { contact_id?: string }) => r.contact_id },
      ],
      page: {
        properties: (f: For) => [
          {
            label: 'Client',
            value: f.contact?.name ?? null,
            href: f.contact ? `/contacts/${f.contact.id}` : undefined,
            lead: 'for',
            edit: { kind: 'pick' as const, write: 'link', field: 'contact', current: f.contact?.id ?? '', options: f.contacts.map((c) => ({ value: c.id, label: c.name })) },
          },
        ],
        related: (f: For) => (f.contact ? [{ label: f.contact.name, sub: 'client', href: `/contacts/${f.contact.id}` }] : []),
      },
    },
    contacts: {
      // Its projects are its Projects tab, counted in the drawer's Related.
      page: {
        scoped: [{ tab: 'projects', collection: 'projects' }],
      },
    },
  },
}
