import type { App } from '@cella/org-ui'
import type { Assigned } from '../models/assignment.ts'

// The graft's client side: who does each task, a column a board may group
// by, and by address the column a member's page jumps to their tasks by,
// in its Related; giving a task to someone on its page, the assignee set
// by a popover on its property.
export const app: App = {
  name: 'membership-task',
  extends: {
    tasks: {
      columns: [
        // A person, by the address they sign with, shown as their chip and
        // grouped as a person.
        { key: 'assigned', label: 'Assignee', kind: 'person', role: 'meta', value: (r: { assigned?: string }) => r.assigned },
      ],
      page: {
        properties: (a: Assigned) => [
          {
            label: 'Assignee',
            value: a.assignee?.address ?? null,
            kind: 'person' as const,
            href: a.assignee ? `/people/${a.assignee.address}` : undefined,
            edit: {
              kind: 'pick' as const,
              write: 'assign',
              field: 'member',
              current: a.assignee?.address ?? '',
              none: 'No one',
              options: a.members.map((m) => ({ value: m.address, label: m.name, who: m.name })),
            },
          },
        ],
      },
    },
  },
}
