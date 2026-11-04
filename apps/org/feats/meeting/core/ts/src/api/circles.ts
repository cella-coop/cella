// The feat's circles: their reads and slice, which the shell mounts: a meeting's
// circle and how it meets, and a circle's meetings.
import type { Slice } from '@cella/org-db'
import { heldBy, onCircle } from '../drivers/circles.ts'

export { heldBy, onCircle, setting } from '../drivers/circles.ts'

export const slice: Slice = {
  name: 'meeting/circles',
  extends: {
    meetings: { item: (db, meeting) => heldBy(db, meeting) },
    circles: { item: (db, circle) => onCircle(db, circle) },
  },
}
