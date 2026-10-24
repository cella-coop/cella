import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a proposal is a fact; put by a member seated in the decision's circle
  'decision:decision:propose': confluent({ check: 'seat' }),
  // signed by the member; their latest vote counts, if they are on the roll
  'decision:decision:vote': confluent({ check: 'roll' }),
  // the notary fixes which votes made the deadline; closed by a member
  // seated in the decision's circle
  'decision:decision:close': ordered({ check: 'seat' }),
} satisfies Ops
