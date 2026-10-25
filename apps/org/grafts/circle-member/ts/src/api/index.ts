// The graft's writes, POST /api/circle-member/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import type { Slice } from '@cella/org-db'
import { circlesOf, held, named, seated, seats } from '../drivers/seat.ts'

export { add, remove, seating } from '../handlers/add.ts'
export { circlesOf, held, named, seated, seats } from '../drivers/seat.ts'

// The seats on both sides of the relationship: who sits in a circle, and
// where a member sits and what that lets them do.
export const slice: Slice = {
  name: 'circle-member',
  extends: {
    circles: {
      list: seated,
      item: async (db, circle) => seats(db, { circle }),
    },
    members: {
      list: circlesOf,
      item: async (db, member) => ({ seats: await seats(db, { member }), held: await held(db, member), name: await named(db, member) }),
    },
  },
}
