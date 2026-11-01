// The feat's public writes, POST /api/circle/<op> once the server exists,
// each decided, which circle-membership-motion carries out when the
// motion that asks it passes; its reads, and its slice, which the
// shell mounts.
import type { Slice } from '@cella/org-db'
import { circle, circles, listing } from '../drivers/circle.ts'

export { grant, nest, revoke } from '../handlers/index.ts'
export { circle, circles } from '../drivers/circle.ts'

export const slice: Slice = {
  name: 'circle',
  collections: {
    circles: {
      list: listing,
      item: circle,
      index: async (db) => (await circles(db)).map((c) => ({ id: c.id, title: c.name, sub: c.purpose })),
    },
  },
}
