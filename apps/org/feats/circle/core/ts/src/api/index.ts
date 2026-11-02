// The feat's public writes, POST /api/circle/<op> once the server exists,
// the nesting decided, which circle-membership-motion carries out when the
// motion that asks it passes, and the state of a mandate's grant and
// revocation, which circle-motion's writes extend; its reads, and its
// slice, which the shell mounts.
import type { Slice } from '@cella/org-db'
import { circle, circles, listing } from '../drivers/circle.ts'

export { granting, nest, revoking } from '../handlers/index.ts'
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
