import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a register on the expense, its claimant's own: the last filing wins
  'expense-project:expense:rebill': confluent({ power: 'claim-expense' }),
} satisfies Actions
