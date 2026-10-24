import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // signed by the member's current key; the address stays
  'key:key:enrol': confluent(),
  // ordered against that device's writes
  'key:key:revoke': ordered(),
  // guardian shares
  'key:key:recover': ordered(),
} satisfies Ops
