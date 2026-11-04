// The feat's seats: their reads, and their slice, which the shell
// mounts. Core's circles give and end a seat (`@cella/org-circle/api`).
import type { Slice } from '@cella/org-db'
import { circlesOf, held, named, seated, seats } from '../drivers/seat.ts'

export { circlesOf, held, named, seated, seats } from '../drivers/seat.ts'

// The seats on both sides of the relationship: who sits in a circle, and
// where a member sits and what that lets them do.
export const slice: Slice = {
  name: 'membership/seats',
  extends: {
    circles: {
      list: seated,
      item: async (db, circle) => seats(db, { circle }),
    },
    people: {
      list: circlesOf,
      item: async (db, member) => ({ seats: await seats(db, { member }), held: await held(db, member), name: await named(db, member) }),
    },
  },
}
