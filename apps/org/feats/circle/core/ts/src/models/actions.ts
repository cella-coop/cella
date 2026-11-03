import { confluent, type Actions } from '@cella/org-actions'

// A mandate has no action of its own: it is granted and revoked as its
// policy is adopted and ended, the motion feat's actions, which
// circle-motion extends with this feat's `granting` and `revoking`. No
// action places a circle: circles never nest.
export const actions = {
  // the circle's channel, for those seated in it
  'circle:circle:message': confluent({ power: 'discuss' }),
} satisfies Actions
