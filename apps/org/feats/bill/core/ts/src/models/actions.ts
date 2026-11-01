import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact from a supplier; the same supplier's reference recorded twice
  // merges into one bill
  'bill:bill:record': confluent({ power: 'record-bill' }),
  // decides the bill once, within the approver's limit for its total
  'bill:bill:approve': ordered({ power: 'approve-bill', amount: 'amount' }),
  // money leaves the bank, once, within the payer's limit
  'bill:bill:pay': ordered({ power: 'pay-supplier', amount: 'amount' }),
} satisfies Actions
