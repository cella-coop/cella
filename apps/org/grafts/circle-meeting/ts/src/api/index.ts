// The graft's reads and its slice, which the shell mounts: a meeting's
// circle and how it meets, and a circle's meetings.
import type { Slice } from '@cella/org-db'
import { heldBy, onCircle } from '../drivers/meeting.ts'

export { heldBy, onCircle, setting } from '../drivers/meeting.ts'

export const slice: Slice = {
  name: 'circle-meeting',
  extends: {
    meetings: { item: (db, meeting) => heldBy(db, meeting) },
    circles: { item: (db, circle) => onCircle(db, circle) },
  },
}
