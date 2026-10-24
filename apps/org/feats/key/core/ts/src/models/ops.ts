import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // ordered against revoke: a stolen key must not enrol a device
  // that survives its own revocation
  'key:key:enrol': ordered(),
  // ordered against that device's writes
  'key:key:revoke': ordered(),
  // guardian shares
  'key:key:recover': ordered(),
} satisfies Ops
