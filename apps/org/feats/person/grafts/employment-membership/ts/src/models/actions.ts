import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact, once to a worker: two openings of one candidacy cannot both
  // stand, whichever comes first, and two workers' commute
  'employment-membership:candidacy:open': confluent({ power: 'hire-worker' }),
} satisfies Actions
