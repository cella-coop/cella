import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // an entry always has both sides; sums of entries commute. Keeping the
  // books is a duty with no limit
  'transaction:transaction:post': confluent({ power: 'record-entry' }),
  // a payment to a supplier, 401 against 512: an entry like any other, so
  // it commutes; what it takes from the bank is capped by the mandate
  'transaction:transaction:pay': confluent({ power: 'pay-supplier', amount: 'amount' }),
  // names the entry it corrects; whether it also needs a vote is a
  // circle setting, not part of the label
  'transaction:transaction:adjust': ordered({ base: 'corrected', power: 'record-entry' }),
} satisfies Ops
