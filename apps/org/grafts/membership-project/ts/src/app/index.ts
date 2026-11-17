import type { App } from '@cella/org-ui'
import type { Pot } from '../models/share.ts'
import Crew from './blocks/Crew.svelte'
import Held from './blocks/Held.svelte'
import Shares from './blocks/Shares.svelte'

// The graft's client side: what each project has shared out of its
// budget, a project's shares and granting one in its Budget tab, its
// crew, Linear's lead and members, set in its People property's popover, and a member's
// shares under Own and decide.
export const app: App = {
  name: 'membership-project',
  extends: {
    projects: {
      columns: [{ key: 'shared', label: 'Shared', kind: 'money', role: 'hidden', value: (r: { shared: number }) => r.shared }],
      page: {
        properties: (p: Pot) => [
          { label: 'Shared', value: p.shared, kind: 'money', group: 'Money' },
          {
            label: 'People',
            value: null,
            people: [...new Set([...(p.lead ? [p.lead.address] : []), ...p.crew.map((m) => m.address)])],
            edit: { block: Crew, data: p },
          },
        ],
        blocks: [{ tab: 'budget', block: Shares }],
      },
    },
    people: {
      page: { blocks: [{ tab: 'membership', block: Held }] },
    },
  },
}
