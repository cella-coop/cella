import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact; two hires of one worker cannot both stand, whichever comes
  // first, and hires of two commute
  'employment:worker:hire': confluent({ power: 'hire-worker' }),
} satisfies Actions
