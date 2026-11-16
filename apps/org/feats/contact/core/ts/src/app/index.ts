import { icons, type App } from '@cella/org-ui'
import type { Contact } from '../models/contact.ts'
import Client from './blocks/Client.svelte'
import Note from './blocks/Note.svelte'

// The feat's client side: the contacts, with a view of the clients among
// them, and a contact's page with its client role and its note, the
// grafts filling its Projects and Invoices tabs.
export const app: App = {
  name: 'contact',
  collections: {
    contacts: {
      view: {
        title: 'Contacts',
        icon: icons.Buildings,
        columns: [
          { key: 'name', label: 'Contact', kind: 'title', role: 'title', value: (c: Contact) => c.name },
          { key: 'form', label: 'Form', role: 'sub', value: (c: Contact) => c.form ?? c.kind },
          { key: 'client', label: 'Client', kind: 'badge', role: 'meta', value: (c: Contact) => c.client },
        ],
        // A client is a contact holding the role, at any of its stages.
        views: [{ id: 'clients', name: 'Clients', where: [{ field: 'client', is: ['lead', 'active', 'inactive'] }] }],
      },
      page: {
        eyebrow: 'Contact',
        title: (c: Contact) => c.name,
        subtitle: (c: Contact) => c.id,
        properties: (c: Contact) => [
          { label: 'Client', value: c.client ?? 'no client', kind: 'badge' },
          { label: 'Kind', value: c.kind },
          { label: 'Form', value: c.form },
          { label: 'Email', value: c.email },
          { label: 'Phone', value: c.phone },
          { label: 'Tags', value: c.tags.join(', ') || null },
        ],
        // A person contact is a core person, whose entry in People holds
        // their name, email and phone.
        related: (c: Contact) => [
          ...(c.parent ? [{ label: c.parent, sub: 'part of', href: `/contacts/${c.parent}` }] : []),
          ...(c.person ? [{ label: c.name, sub: 'person', href: `/people/${c.person}` }] : []),
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'projects', label: 'Projects' },
          { id: 'invoices', label: 'Invoices' },
        ],
        blocks: [Client, Note],
      },
    },
  },
}
