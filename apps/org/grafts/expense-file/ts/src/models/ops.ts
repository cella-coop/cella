import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a receipt is a fact, the member's own: two attached commute
  'expense-file:expense:attach': confluent({ check: 'self' }),
} satisfies Ops
