import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a member's own report; the last save wins
  'report:report:save': confluent({ check: 'self' }),
} satisfies Actions
