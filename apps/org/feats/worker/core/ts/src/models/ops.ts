import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; two hires of one worker cannot both stand, whichever comes
  // first, and hires of two commute
  'worker:worker:hire': confluent({ power: 'hire-worker' }),
} satisfies Ops
