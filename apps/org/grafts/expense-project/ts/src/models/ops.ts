import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a register on the expense, its member's own: the last filing wins
  'expense-project:expense:rebill': confluent({ check: 'self' }),
} satisfies Ops
