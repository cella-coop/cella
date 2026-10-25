import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact, once to a worker: two openings of one candidacy cannot both
  // stand, whichever comes first, and two workers' commute
  'member-worker:candidacy:open': confluent({ power: 'hire-worker' }),
} satisfies Ops
