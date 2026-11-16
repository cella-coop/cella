import type { App } from '@cella/org-ui'
import type { Commissioned, For } from '../models/commission.ts'
import Contact from './blocks/Contact.svelte'
import Projects from './blocks/Projects.svelte'

// The graft's client side: whom a project is for and the form that links
// it, in the project's Details beside its Client property, and the
// projects a contact commissioned, in its Projects tab.
export const app: App = {
  name: 'contact-project',
  extends: {
    projects: {
      columns: [{ key: 'contact', label: 'Client', role: 'sub', value: (r: { contact?: string }) => r.contact }],
      page: {
        properties: (f: For) => [{ label: 'Client', value: f.contact?.name ?? 'own', href: f.contact ? `/contacts/${f.contact.id}` : undefined }],
        related: (f: For) => (f.contact ? [{ label: f.contact.name, sub: 'client', href: `/contacts/${f.contact.id}` }] : []),
        details: [Contact],
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
