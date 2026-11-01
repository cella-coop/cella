import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a proposal is a fact; put by a member seated in the decision's circle
  'decision:decision:propose': confluent({ check: 'seat' }),
  // signed by the member; their latest vote counts, if they are on the roll
  'decision:decision:vote': confluent({ check: 'roll' }),
  // the notary fixes which votes made the deadline; closed by a member
  // seated in the decision's circle
  'decision:decision:close': ordered({ check: 'seat' }),
  // a message on its deliberation: messages add up in any order, each the
  // author's own; posted by a member seated in the decision's circle
  'decision:message:post': confluent({ check: 'seat' }),
} satisfies Actions
