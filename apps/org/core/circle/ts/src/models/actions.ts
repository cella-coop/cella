import { confluent, ordered, type Actions } from '@cella/org-actions'

// A mandate has no action of its own: it is granted and revoked as its
// policy is adopted and ended, the motion feat's actions, which the motion
// feat extends with core's `granting` and `revoking`. Creating a circle
// places it nowhere: circles never nest.
export const actions = {
  // a new circle, by the motion it cites, holding the default bundle from
  // that day; ordered, since the same motion's later actions seat people in it
  'circle:circle:create': ordered({ power: 'create-circle' }),
  // the circle's channel, for those seated in it
  'circle:circle:message': confluent({ power: 'discuss' }),
  // who holds which role; a seat is given by the motion it cites, such
  // as the admission that seats a new member in the assembly
  'circle:seat:add': ordered({ power: 'seat-member' }),
  // who holds which role; a seat is ended by the motion it cites
  'circle:seat:remove': ordered({ power: 'seat-member' }),
} satisfies Actions
