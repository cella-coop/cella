// The log's reads, and its slice, which the shell mounts. The log has no
// writes of its own: only the notary appends to it.
import type { Slice } from '@cella/org-db'
import { detail, entries, head, listing } from '../drivers/log.ts'

export { detail, entries, head, named, scope } from '../drivers/log.ts'

export const slice: Slice = {
  name: 'log',
  collections: {
    log: {
      list: listing,
      about: head,
      item: detail,
      index: async (db) => (await entries(db)).map((e) => ({ id: e.id, title: `Entry ${e.n}`, sub: `${e.op} by ${e.actor}` })),
    },
  },
}
