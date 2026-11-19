import { icons, type App } from '@cella/org-ui'
import type { Contact } from '../models/contact.ts'
import Client from './blocks/Client.svelte'
import Body from './blocks/Body.svelte'

// The feat's client side: the contacts, with a view of the clients among
// them, and a contact's page, which opens on its client role, then its
// notes, its body, the grafts filling its Projects and Invoices tabs.
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
        // Grouped by the client's stage, contacts that are no client
        // after them, by name.
        look: { by: 'client', sort: { field: 'name', dir: 'asc' }, lanes: { client: ['lead', 'active', 'inactive'] } },
        // A client is a contact holding the role, at any of its stages.
        views: [{ id: 'clients', name: 'Clients', where: [{ field: 'client', is: ['lead', 'active', 'inactive'] }] }],
      },
      page: {
        eyebrow: 'Contact',
        title: (c: Contact) => c.name,
        subtitle: (c: Contact) => c.id,
        properties: (c: Contact) => [
          { label: 'Client', value: c.client ?? 'no client', kind: 'badge', lead: c.client ? 'client' : undefined },
          { label: 'Kind', value: c.kind, glyph: c.kind === 'person' ? icons.User : icons.Buildings },
          { label: 'Legal form', value: c.form, glyph: icons.Certificate },
          { label: 'Email', value: c.email, glyph: icons.Envelope },
          { label: 'Phone', value: c.phone, glyph: icons.Phone },
          { label: 'Tags', value: c.tags.join(', ') || null, glyph: icons.Tag },
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
        layout: 'panels',
        body: Body,
        blocks: [Client],
      },
    },
  },
}
