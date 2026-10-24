// The graft's reads and its slice, which the shell mounts: who is
// expected at a meeting, who came and whether it is quorate. Its rules
// are SQL: the agenda is its circle's members', a power over a meeting
// reaches its circle, and the minutes' keeper records only those
// expected.
import type { Slice } from '@cella/org-db'
import { onMeeting, quorums } from '../drivers/roll.ts'

export { onMeeting, quorums } from '../drivers/roll.ts'

export const slice: Slice = {
  name: 'circle-meeting-member',
  extends: {
    meetings: {
      list: quorums,
      item: (db, meeting, actor) => onMeeting(db, meeting, actor),
    },
  },
}
