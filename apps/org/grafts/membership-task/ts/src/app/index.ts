import type { App } from '@cella/org-ui'
import type { Assigned } from '../models/assignment.ts'
import Assignee from './blocks/Assignee.svelte'

// The graft's client side: who does each task, a column a board may group
// by, and by address the column a member's page jumps to their tasks by,
// in its Related; giving a task to someone on its page, the assignee set
// in the task's Details.
export const app: App = {
  name: 'membership-task',
  extends: {
    tasks: {
      columns: [
        { key: 'assignee', label: 'Assignee', kind: 'badge', role: 'meta', record: 'people', value: (r: { assignee?: string }) => r.assignee },
        { key: 'assigned', label: 'Assigned to', kind: 'person', role: 'hidden', value: (r: { assigned?: string }) => r.assigned },
      ],
      page: {
        properties: (a: Assigned) => [
          { label: 'Assignee', value: a.assignee?.name ?? 'no one', href: a.assignee ? `/people/${a.assignee.address}` : undefined },
        ],
        details: [Assignee],
      },
    },
  },
}
