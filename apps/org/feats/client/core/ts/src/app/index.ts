import { icons, type App } from '@cella/org-ui'
import type { Client } from '../models/client.ts'
import Note from './blocks/Note.svelte'

// The feat's client side: the clients, and a client's page with its note.
export const app: App = {
  name: 'client',
  collections: {
    clients: {
      view: {
        group: 'work',
        title: 'Clients',
        icon: icons.Buildings,
        columns: [
          { key: 'name', label: 'Client', kind: 'title', role: 'title', value: (c: Client) => c.name },
          { key: 'form', label: 'Form', role: 'sub', value: (c: Client) => c.form ?? c.kind },
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (c: Client) => c.status },
        ],
      },
      page: {
        eyebrow: 'Client',
        title: (c: Client) => c.name,
        subtitle: (c: Client) => c.form ?? c.kind,
        properties: (c: Client) => [
          { label: 'Status', value: c.status, kind: 'badge' },
          { label: 'Kind', value: c.kind },
          { label: 'Form', value: c.form },
          { label: 'Email', value: c.email },
          { label: 'Phone', value: c.phone },
          { label: 'Tags', value: c.tags.join(', ') || null },
        ],
        related: (c: Client) => (c.parent ? [{ label: c.parent, sub: 'part of', href: `/clients/${c.parent}` }] : []),
        blocks: [Note],
      },
    },
  },
}
