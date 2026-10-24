import { bounded, confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // deposits merge
  'transaction:transaction:credit': confluent(),
  // from a share; beyond it, ordered
  'transaction:transaction:debit': bounded('share'),
  // a correction, which needs a decision
  'transaction:transaction:adjust': ordered({ decide: 'majority' }),
} satisfies Ops
