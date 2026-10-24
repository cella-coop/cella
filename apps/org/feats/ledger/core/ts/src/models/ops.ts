import { bounded, confluent, ordered, type Ops } from '@cella/org-core'

export const ops = {
  // deposits merge
  'ledger:entry:credit': confluent(),
  // from a share; beyond it, ordered
  'ledger:entry:debit': bounded('share'),
  // a correction, which needs a decision
  'ledger:entry:adjust': ordered({ decide: 'majority' }),
  // nothing posts into a closed period
  'ledger:period:close': ordered(),
} satisfies Ops
