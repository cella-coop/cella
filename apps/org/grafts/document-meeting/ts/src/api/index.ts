// The graft's write, which is the meeting feat's beginning of the minutes
// with the document they are written in, its reads, and its slice, which
// the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { minute } from '../handlers/minute.ts'
import { onDocument, onMeeting } from '../drivers/minutes.ts'

export { minute } from '../handlers/minute.ts'
export { onDocument, onMeeting, summaries } from '../drivers/minutes.ts'

// A meeting's minutes and beginning them, which replaces the meeting
// feat's own; on a document's page, the meeting it minutes and the
// meetings it may embed.
export const slice: Slice = {
  name: 'document-meeting',
  extends: {
    meetings: {
      item: (db, meeting) => onMeeting(db, meeting),
      actions: {
        minute: action('meeting:meeting:minute', (_, id) => ({ meeting: id ?? '' }), minute),
      },
    },
    documents: {
      item: (db, document) => onDocument(db, document),
    },
  },
}
