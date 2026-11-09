import type { App } from '@cella/org-ui'
import type { Charged, Invoiced } from '../models/charge.ts'
import Invoices from './blocks/Invoices.svelte'
import Project from './blocks/Project.svelte'

// The graft's client side: the project an invoice bills and the form that
// names it; what each project invoiced, and a project's invoices in its
// Invoices tab.
export const app: App = {
  name: 'invoice-project',
  extends: {
    invoices: {
      columns: [{ key: 'project', label: 'Project', role: 'hidden', value: (r: { project?: string }) => r.project }],
      page: {
        properties: (c: Charged) => [{ label: 'Project', value: c.project?.title ?? 'none', href: c.project ? `/projects/${c.project.id}` : undefined }],
        related: (c: Charged) => (c.project ? [{ label: c.project.title, sub: 'project', href: `/projects/${c.project.id}` }] : []),
        blocks: [Project],
      },
    },
    projects: {
      columns: [{ key: 'invoiced', label: 'Invoiced', kind: 'money', role: 'hidden', value: (r: { invoiced: number }) => r.invoiced }],
      page: {
        properties: (i: Invoiced) => [{ label: 'Invoiced', value: i.net, kind: 'money' }],
        tabs: [{ id: 'invoices', label: 'Invoices' }],
        blocks: [{ tab: 'invoices', block: Invoices }],
      },
    },
  },
}
