import type { Lifecycle } from '@cella/org-ui/models'

// A task's lifecycle, in the order the board's columns follow: at rest,
// up next, under way, waiting on a check, done. Active and review are
// both under way, review the later; every status but done is open.
// `cella check feats` holds it equal to task.task's CHECK.
export const status = {
  column: 'task.status',
  states: [
    { value: 'backlog', category: 'backlog' },
    { value: 'next', category: 'unstarted' },
    { value: 'active', category: 'started' },
    { value: 'review', category: 'started' },
    { value: 'done', category: 'completed' },
  ],
} as const satisfies Lifecycle
