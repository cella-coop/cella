import type { Lifecycle } from '@cella/org-ui/models'

// An expense's lifecycle, in the board's order: the way forward, then the
// way out. Submitted and approved are both under way, approved the later;
// refused ends it, and stays negative. `cella check feats` holds it equal
// to expense.expense's CHECK.
export const status = {
  column: 'expense.status',
  states: [
    { value: 'draft', category: 'unstarted' },
    { value: 'submitted', category: 'started' },
    { value: 'approved', category: 'started' },
    { value: 'reimbursed', category: 'completed' },
    { value: 'refused', category: 'cancelled', tone: 'negative' },
  ],
} as const satisfies Lifecycle
