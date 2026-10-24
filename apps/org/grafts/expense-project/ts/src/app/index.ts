import type { App } from '@cella/org-ui'
import type { Filed } from '../models/rebill.ts'
import Project from './blocks/Project.svelte'
import Spent from './blocks/Spent.svelte'

// The graft's client side: the project an expense is billed on to, in the
// list and on its page, and what each project's members spent for it.
export const app: App = {
  name: 'expense-project',
  extends: {
    expenses: {
      columns: [{ key: 'project', label: 'Project', kind: 'badge', role: 'hidden', value: (r: { project?: string }) => r.project ?? 'the co-op' }],
      page: {
        related: (f: Filed) => (f.project ? [{ label: f.title ?? f.project, sub: 'billed on to', href: `/projects/${f.project}` }] : []),
        blocks: [Project],
      },
    },
    projects: {
      page: { blocks: [{ tab: 'expenses', block: Spent }], tabs: [{ id: 'expenses', label: 'Expenses' }] },
    },
  },
}
