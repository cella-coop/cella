// Core's circles, POST /api/circle/<op> once the server exists: the state
// of a mandate's grant and revocation, which the motion feat's writes
// extend; the circles and the seats, which a passing motion creates,
// gives and ends; its reads, and its slice, which the shell mounts.
import type { Slice } from '@cella/org-db'
import { circle, circles, listing } from '../drivers/circle.ts'

export { granting, revoking } from '../handlers/index.ts'
export { create } from '../handlers/circle.ts'
export { add, remove, seating } from '../handlers/seat.ts'
export { circle, circles } from '../drivers/circle.ts'

// Core's slice: every feat builds on core, so any slice may extend its
// collection.
export const slice: Slice = {
  name: 'circle',
  core: true,
  collections: {
    circles: {
      list: listing,
      item: circle,
      index: async (db) => (await circles(db)).map((c) => ({ id: c.id, title: c.name, sub: c.purpose })),
    },
  },
}
