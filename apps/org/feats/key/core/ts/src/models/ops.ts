import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // ordered against revoke: a stolen key must not enrol a device
  // that survives its own revocation; the member's own
  'key:key:enrol': ordered({ check: 'self' }),
  // ordered against that device's writes; the member's own
  'key:key:revoke': ordered({ check: 'self' }),
  // guardian shares, not built
  'key:key:recover': ordered({ power: 'recover-key' }),
} satisfies Ops
