import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a receipt is a fact, the member's own: two attached commute
  'expense-file:expense:attach': confluent({ check: 'self' }),
} satisfies Actions
