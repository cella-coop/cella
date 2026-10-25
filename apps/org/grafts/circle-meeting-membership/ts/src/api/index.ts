// The graft's reads and its slice, which the shell mounts: who is
// expected at a meeting, who came and whether it is quorate. Its rules
// are SQL: the agenda is its circle's members', a power over a meeting
// reaches its circle, and the minutes' keeper records only those
// expected. The meetings a member has yet to answer wait in their inbox.
import type { Slice } from '@cella/org-db'
import { onMeeting, quorums } from '../drivers/roll.ts'
import { meetings } from '../drivers/inbox.ts'

export { onMeeting, quorums } from '../drivers/roll.ts'
export { meetings } from '../drivers/inbox.ts'

export const slice: Slice = {
  name: 'circle-meeting-membership',
  extends: {
    meetings: {
      list: quorums,
      item: (db, meeting, actor) => onMeeting(db, meeting, actor),
    },
    // The meetings waiting on the acting member's answer, in their inbox.
    inbox: { rows: meetings },
  },
}
