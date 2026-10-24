// The feat's public writes, POST /api/transaction/<op> once the server
// exists. `record` and the write specs let a graft post an entry inside its
// own write's transaction. Its reads, and its slice, which the shell mounts.
import type { Slice } from '@cella/org-db'
import { entry, journal } from '../drivers/journal.ts'

export { adjust, adjusting, pay, paying, payroll, post, posting, record, running } from '../handlers/index.ts'
export { entry, journal } from '../drivers/journal.ts'

// The journal. Posting through the shell is not offered yet: the pilot's
// entries come from invoices, through the invoice-transaction graft.
export const slice: Slice = {
  name: 'transaction',
  collections: {
    journal: {
      list: journal,
      item: entry,
      index: async (db) => (await journal(db)).map((e) => ({ id: e.id, title: e.id, sub: e.label })),
    },
  },
}
