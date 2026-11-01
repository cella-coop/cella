import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a member's own record, a fact: two filed commute
  'file-membership:member:attach': confluent({ check: 'self' }),
} satisfies Actions
