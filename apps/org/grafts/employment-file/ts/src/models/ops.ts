import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // an employment record, kept by whoever hires: two filed commute
  'employment-file:worker:attach': confluent({ power: 'hire-worker' }),
} satisfies Ops
