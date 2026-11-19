import type { Lifecycle } from '@cella/org-ui/models'

// A meeting's lifecycle: scheduled, then held or cancelled, each settled
// on its day. `cella check feats` holds it equal to meeting.meeting's
// CHECK.
export const status = {
  column: 'meeting.status',
  states: [
    { value: 'scheduled', category: 'unstarted' },
    { value: 'held', category: 'completed' },
    { value: 'cancelled', category: 'cancelled' },
  ],
} as const satisfies Lifecycle
