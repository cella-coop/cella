import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a proposal is a fact; put by a member seated in the motion's circle
  'motion:motion:propose': confluent({ check: 'seat' }),
  // signed by the member; their latest vote counts, if they are on the roll
  'motion:motion:vote': confluent({ check: 'roll' }),
  // the notary fixes which votes made the deadline; closed by a member
  // seated in the motion's circle
  'motion:motion:close': ordered({ check: 'seat' }),
  // a message on its deliberation: messages add up in any order, each the
  // author's own; posted by a member seated in the motion's circle
  'motion:message:post': confluent({ check: 'seat' }),
  // a policy its circle adopts, a sentence that binds; the cited motion
  // carries it
  'motion:policy:adopt': ordered({ check: 'decided' }),
  // a policy its circle ends, which binds no longer from its verdict; the
  // cited motion ends it
  'motion:policy:end': ordered({ check: 'decided' }),
} satisfies Actions
