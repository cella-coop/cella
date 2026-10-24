// The feat's reads and its slice, which the shell mounts. Nesting circles
// and granting mandates have no handlers yet.
import type { Slice } from '@cella/org-db'
import { circle, circles } from '../drivers/circle.ts'

export { circle, circles } from '../drivers/circle.ts'

export const slice: Slice = {
  name: 'circle',
  collections: {
    circles: {
      list: circles,
      item: circle,
      index: async (db) => (await circles(db)).map((c) => ({ id: c.id, title: c.name, sub: c.purpose })),
    },
  },
}
