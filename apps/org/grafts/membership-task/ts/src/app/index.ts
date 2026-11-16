import type { App } from '@cella/org-ui'
import type { Assigned } from '../models/assignment.ts'
import Assignee from './blocks/Assignee.svelte'
import Doing from './blocks/Doing.svelte'

// The graft's client side: who does each task, a column a board may group
// by, giving a task to someone on its page, and the tasks a member does,
// in a Tasks tab on theirs.
export const app: App = {
  name: 'membership-task',
  extends: {
    tasks: {
      columns: [{ key: 'assignee', label: 'Assignee', kind: 'badge', role: 'meta', record: 'people', value: (r: { assignee?: string }) => r.assignee }],
      page: {
        properties: (a: Assigned) => [
          { label: 'Assignee', value: a.assignee?.name ?? 'no one', href: a.assignee ? `/people/${a.assignee.address}` : undefined },
        ],
        blocks: [Assignee],
      },
    },
    people: {
      page: { tabs: [{ id: 'tasks', label: 'Tasks' }], blocks: [{ tab: 'tasks', block: Doing }] },
    },
  },
}
