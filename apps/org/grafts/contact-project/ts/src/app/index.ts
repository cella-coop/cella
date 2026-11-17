import type { App } from '@cella/org-ui'
import type { Commissioned, For } from '../models/commission.ts'
import Projects from './blocks/Projects.svelte'

// The graft's client side: whom a project is for and the popover that links
// it, on its Client property, and the
// projects a contact commissioned, in its Projects tab.
export const app: App = {
  name: 'contact-project',
  extends: {
    projects: {
      columns: [{ key: 'contact', label: 'Client', role: 'sub', value: (r: { contact?: string }) => r.contact }],
      page: {
        properties: (f: For) => [
          {
            label: 'Client',
            value: f.contact?.name ?? null,
            href: f.contact ? `/contacts/${f.contact.id}` : undefined,
            edit: { kind: 'pick' as const, write: 'link', field: 'contact', current: f.contact?.id ?? '', options: f.contacts.map((c) => ({ value: c.id, label: c.name })) },
          },
        ],
        related: (f: For) => (f.contact ? [{ label: f.contact.name, sub: 'client', href: `/contacts/${f.contact.id}` }] : []),
      },
    },
    contacts: {
      page: {
        properties: (ps: Commissioned[]) => [{ label: 'Projects', value: ps.length, kind: 'number' }],
        blocks: [{ tab: 'projects', block: Projects }],
      },
    },
  },
}
