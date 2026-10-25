import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a member's own record, a fact: two filed commute
  'file-membership:member:attach': confluent({ check: 'self' }),
} satisfies Ops
