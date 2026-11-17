// The feat's public writes, POST /api/transaction/<op> once the server
// exists. `record` and the write specs let a graft post an entry inside its
// own write's transaction. Its reads, and its slice, which the shell mounts.
import type { Slice } from '@cella/org-db'
import { entry, journal, listing } from '../drivers/journal.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount, withBody } from './body.ts'

export { adjust, adjusting, logged, pay, paying, post, posting, record } from '../handlers/index.ts'
export { entry, journal } from '../drivers/journal.ts'
export { saveBody } from '../handlers/body.ts'

// The journal, as the shell's transactions. Posting through the shell is
// not offered yet: the pilot's entries come from invoices, through the
// invoice-transaction graft.
export const slice: Slice = {
  name: 'transaction',
  queries: contract,
  collections: {
    transactions: {
      list: listing,
      item: withBody(entry),
      index: async (db) => (await journal(db)).map((e) => ({ id: e.id, title: e.id, sub: e.label })),
      body: bodyMount,
      actions: {
        ...bodyActions,
      },
    },
  },
}
