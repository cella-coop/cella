import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a person's own fields
  'person:person:profile': confluent({ power: 'keep-profile' }),
  // erasure wins over every update; a person's own contact details
  'person:person:forget': ordered({ power: 'keep-profile' }),
  // ordered against revoke: a stolen key must not enrol a device
  // that survives its own revocation; the person's own
  'person:device:enrol': ordered({ power: 'keep-devices' }),
  // ordered against that device's writes; the person's own
  'person:device:revoke': ordered({ power: 'keep-devices' }),
  // guardian shares, not built
  'person:device:recover': ordered({ power: 'recover-key' }),
} satisfies Actions
