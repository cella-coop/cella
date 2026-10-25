// The graft's writes, POST /api/meeting-membership/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { mark, record } from '../handlers/attend.ts'
import { attended, marks, present } from '../drivers/attendance.ts'
import type { Attend, Status } from '../models/attendance.ts'

export { mark, record } from '../handlers/attend.ts'
export { attended, marks, present } from '../drivers/attendance.ts'

const attend = (form: Form, meeting: string, member: string): Attend => ({ meeting, member, status: form.get('status') as Status })

// How many came to each meeting and who was marked, a member marking
// their own attendance and the minutes' keeper recording anyone's; on a
// member's page, the meetings they were marked at.
export const slice: Slice = {
  name: 'meeting-membership',
  extends: {
    meetings: {
      list: present,
      item: (db, meeting) => marks(db, meeting),
      actions: {
        attend: action('meeting-membership:attendance:mark', (form, id, deps) => attend(form, id ?? '', deps.actor), mark),
        record: action('meeting-membership:attendance:record', (form, id) => attend(form, id ?? '', form.get('member')), record),
      },
    },
    people: {
      item: (db, member) => attended(db, member),
    },
  },
}
