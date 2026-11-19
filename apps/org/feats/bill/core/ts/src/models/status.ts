import type { Lifecycle } from '@cella/org-ui/models'

// A bill's lifecycle: recorded, approved, paid. Overdue is no status of
// its: its standing reads it from its due day, beside these. `cella check
// feats` holds it equal to bill.bill's CHECK.
export const status = {
  column: 'bill.status',
  states: [
    { value: 'recorded', category: 'unstarted' },
    { value: 'approved', category: 'started' },
    { value: 'paid', category: 'completed' },
  ],
} as const satisfies Lifecycle
