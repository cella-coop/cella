// Core's circles, POST /api/circle/<op> once the server exists: the
// circles, their roles and the seats, which a passing motion creates, amends, gives and ends;
// its reads, and its slice, which the shell mounts. A mandate's grant and
// revocation, which the motion feat's writes extend, are core's graft
// joining the circles to the register's, circle-policy's.
import type { Slice } from '@cella/org-db'
import { circle, circles, listing, mandate, mandating } from '../drivers/circle.ts'

export { amend, create } from '../handlers/circle.ts'
export { make, remake } from '../handlers/role.ts'
export { add, remove, seatRole, seating, unseatRole } from '../handlers/seat.ts'
export { circle, circles, lenses, mandate, sitting } from '../drivers/circle.ts'

// Core's slice: every feat builds on core, so any slice may extend its
// collections, the circles and the mandates that link them.
export const slice: Slice = {
  name: 'circle',
  core: true,
  collections: {
    circles: {
      list: listing,
      item: circle,
      index: async (db) => (await circles(db)).map((c) => ({ id: c.id, title: c.name, sub: c.purpose })),
    },
    mandates: {
      list: mandating,
      item: mandate,
    },
  },
}
