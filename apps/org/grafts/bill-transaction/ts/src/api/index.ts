// The graft's writes: a bill event and its posting, in one write; its
// reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-bill/api'
import { approve, pay } from '../handlers/post.ts'
import { postings } from '../drivers/posting.ts'
import { contract } from './contract.ts'

export { approve, pay } from '../handlers/post.ts'
export { postings } from '../drivers/posting.ts'

// A bill's postings on its page, and its approval and payment replaced by
// the writes that post them to the books in the same verdict.
export const slice: Slice = {
  name: 'bill-transaction',
  queries: contract,
  extends: {
    bills: {
      item: postings,
      actions: {
        approve: action('bill:bill:approve', (_, id) => forms.act(id ?? ''), approve),
        pay: action('bill:bill:pay', (_, id) => forms.act(id ?? ''), pay),
      },
    },
  },
}
