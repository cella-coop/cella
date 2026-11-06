import { icons, type App } from '@cella/org-ui'
import type { Contact } from '../models/contact.ts'
import Client from './blocks/Client.svelte'
import Note from './blocks/Note.svelte'

// The feat's client side: the contacts, with a view of the clients among
// them, and a contact's page with its client role and its note.
export const app: App = {
  name: 'contact',
  collections: {
    contacts: {
      view: {
        group: 'work',
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
        subtitle: (c: Contact) => c.form ?? c.kind,
        properties: (c: Contact) => [
          { label: 'Client', value: c.client ?? 'no client', kind: 'badge' },
          { label: 'Kind', value: c.kind },
          { label: 'Form', value: c.form },
          { label: 'Email', value: c.email },
          { label: 'Phone', value: c.phone },
          { label: 'Tags', value: c.tags.join(', ') || null },
        ],
        related: (c: Contact) => (c.parent ? [{ label: c.parent, sub: 'part of', href: `/contacts/${c.parent}` }] : []),
        blocks: [Client, Note],
      },
    },
  },
}
