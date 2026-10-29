import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a member's own report; the last save wins
  'report:report:save': confluent({ check: 'self' }),
} satisfies Ops
