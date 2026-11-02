import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a proposal is a fact; put by a participant of the motion's circle
  'motion:motion:propose': confluent({ power: 'propose' }),
  // signed by the member; their latest vote counts, if they are on the roll
  'motion:motion:vote': confluent({ check: 'roll' }),
  // the notary fixes which votes made the deadline; closed by a
  // participant of the motion's circle
  'motion:motion:close': ordered({ power: 'propose' }),
  // a message on its deliberation: messages add up in any order, each the
  // author's own; posted by a participant of the motion's circle
  'motion:message:post': confluent({ power: 'discuss' }),
  // a policy its circle adopts, a sentence that binds; the cited motion
  // carries it
  'motion:policy:adopt': ordered({ power: 'adopt-policy' }),
  // a policy its circle ends, which binds no longer from its verdict; the
  // cited motion ends it
  'motion:policy:end': ordered({ power: 'end-policy' }),
} satisfies Actions
