import { confluent, ordered, type Actions } from '@cella/org-actions'

// A mandate has no action of its own: it is granted and revoked as its
// policy is adopted and ended, the motion feat's actions, which
// circle-motion extends with this feat's `granting` and `revoking`.
export const actions = {
  // two nestings can form a cycle even online, so this orders already
  // at rung 1; the cited motion nests the circle
  'circle:circle:nest': ordered({ check: 'decided' }),
  // the circle's channel, for those seated in it
  'circle:circle:message': confluent({ check: 'seat' }),
} satisfies Actions
