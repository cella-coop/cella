import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // an entry carried over from the last tool's books: entries add up in
  // any order, and an account it opens twice keeps the first label
  'account-transaction:entry:carry': confluent({ power: 'carry-books' }),
} satisfies Ops
