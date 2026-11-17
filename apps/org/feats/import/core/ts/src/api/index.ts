// The feat's write, its reads and its slice, which the shell mounts: the
// imports made, and each one's lines. What reads a file, and the writes
// its lines make, are the slices' that own them; running an import across
// them is the root's, which records it here.
import type { Slice } from '@cella/org-db'
import { listing, run, runs } from '../drivers/run.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount, withBody } from './body.ts'

export { record } from '../handlers/index.ts'
export { run, runs } from '../drivers/run.ts'
export { saveBody } from '../handlers/body.ts'

export const slice: Slice = {
  name: 'import',
  queries: contract,
  collections: {
    imports: {
      list: listing,
      item: withBody(run),
      about: async () => ({ kinds: [] }),
      index: async (db) => (await runs(db)).map((r) => ({ id: r.id, title: `${r.name}, ${r.kind}`, sub: `${r.id}, ${r.day}` })),
      body: bodyMount,
      actions: {
        ...bodyActions,
      },
    },
  },
}
