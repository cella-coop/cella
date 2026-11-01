import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a member's own report, by their right; the last save wins
  'report:report:save': confluent({ power: 'save-report' }),
} satisfies Actions
