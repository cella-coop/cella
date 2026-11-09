// The graft's writes: an expense's approval and reimbursement with their
// postings, each in one write; its reads, and its slice, which the shell
// mounts.
import { action, type Slice } from '@cella/org-db'
import { approve, reimburse } from '../handlers/post.ts'
import { postings } from '../drivers/posting.ts'
import { contract } from './contract.ts'

export { approve, reimburse } from '../handlers/post.ts'
export { postings } from '../drivers/posting.ts'

export const slice: Slice = {
  name: 'expense-transaction',
  queries: contract,
  extends: {
    expenses: {
      item: postings,
      actions: {
        approve: action('expense:expense:approve', (_, id) => ({ expense: id ?? '' }), approve),
        reimburse: action('expense:expense:reimburse', (_, id) => ({ expense: id ?? '' }), reimburse),
      },
    },
  },
}
