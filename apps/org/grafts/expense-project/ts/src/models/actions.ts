import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a register on the expense, its member's own: the last filing wins
  'expense-project:expense:rebill': confluent({ check: 'self' }),
} satisfies Actions
