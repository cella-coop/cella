import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // an entry always has both sides; sums of entries commute. Its amount,
  // the sum of its debits, is capped by the mandate's limit
  'transaction:transaction:post': confluent({ power: 'pay-supplier', amount: 'amount' }),
  // names the entry it corrects; whether it also needs a vote is a
  // circle setting, not part of the label
  'transaction:transaction:adjust': ordered({ base: 'corrected' }),
} satisfies Ops
