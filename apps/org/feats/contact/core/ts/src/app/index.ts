import { icons, type App } from '@cella/org-ui'
import type { Contact } from '../models/contact.ts'
import Note from './blocks/Note.svelte'

// The feat's client side: the contacts, and a contact's page with its note.
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
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (c: Contact) => c.status },
        ],
      },
      page: {
        eyebrow: 'Contact',
        title: (c: Contact) => c.name,
        subtitle: (c: Contact) => c.form ?? c.kind,
        properties: (c: Contact) => [
          { label: 'Status', value: c.status, kind: 'badge' },
          { label: 'Kind', value: c.kind },
          { label: 'Form', value: c.form },
          { label: 'Email', value: c.email },
          { label: 'Phone', value: c.phone },
          { label: 'Tags', value: c.tags.join(', ') || null },
        ],
        related: (c: Contact) => (c.parent ? [{ label: c.parent, sub: 'part of', href: `/contacts/${c.parent}` }] : []),
        blocks: [Note],
      },
    },
  },
}
