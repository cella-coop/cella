import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a proposal is a fact
  'decision:decision:propose': confluent(),
  // signed by the member; their latest vote counts
  'decision:decision:vote': confluent(),
  // the notary fixes which votes made the deadline
  'decision:decision:close': ordered(),
} satisfies Ops
