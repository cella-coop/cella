import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // an employment record, kept by whoever hires: two filed commute
  'employment-file:worker:attach': confluent({ power: 'hire-worker' }),
} satisfies Actions
