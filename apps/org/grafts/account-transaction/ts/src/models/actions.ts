import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // an entry carried over from the last tool's books: entries add up in
  // any order, and an account it opens twice keeps the first label
  'account-transaction:entry:carry': confluent({ power: 'carry-books' }),
} satisfies Actions
