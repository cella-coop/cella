import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a receipt is a fact, the claimant's own: two attached commute
  'expense-file:expense:attach': confluent({ power: 'claim-expense' }),
} satisfies Actions
