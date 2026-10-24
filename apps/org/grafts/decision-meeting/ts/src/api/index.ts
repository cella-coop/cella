// The graft's write, which is the meeting feat's agenda item with the
// decision it tables, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-meeting/api'
import { table } from '../handlers/table.ts'
import { onMeeting, sittings } from '../drivers/tabled.ts'

export { table } from '../handlers/table.ts'
export { onMeeting, sittings } from '../drivers/tabled.ts'

// The decisions a meeting's agenda tables and tabling one, and on a
// decision's page the meetings it is tabled at.
export const slice: Slice = {
  name: 'decision-meeting',
  extends: {
    meetings: {
      item: (db, meeting) => onMeeting(db, meeting),
      actions: {
        table: action('meeting:item:add', (form, id) => ({ ...forms.add(form, id ?? ''), decision: form.get('decision') }), table),
      },
    },
    decisions: {
      item: (db, decision) => sittings(db, decision),
    },
  },
}
