import type { App } from '@cella/org-ui'
import type { Pot } from '../models/share.ts'
import Held from './blocks/Held.svelte'
import Shares from './blocks/Shares.svelte'

// The graft's client side: what each project has shared out of its
// budget, a project's shares and granting one, and a member's shares.
export const app: App = {
  name: 'membership-project',
  extends: {
    projects: {
      columns: [{ key: 'shared', label: 'Shared', kind: 'money', role: 'hidden', value: (r: { shared: number }) => r.shared }],
      page: {
        properties: (p: Pot) => [{ label: 'Shared', value: p.shared, kind: 'money' }],
        blocks: [Shares],
      },
    },
    people: {
      page: { blocks: [Held] },
    },
  },
}
