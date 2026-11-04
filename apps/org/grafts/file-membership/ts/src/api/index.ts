// The graft's write, reads and slice, which the shell mounts: on a
// member's page the records on their file, and another filed; a member
// files their own; and a personal file opened to whoever holds a power
// over what it records.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-file/api'
import { attach } from '../handlers/index.ts'
import { records } from '../drivers/record.ts'
import { opens } from '../drivers/opens.ts'

export { attach } from '../handlers/index.ts'
export { records } from '../drivers/record.ts'
export { opens } from '../drivers/opens.ts'

export const slice: Slice = {
  name: 'file-membership',
  extends: {
    people: {
      item: async (db, id) => ({ records: await records(db, id) }),
      actions: {
        record: action('file-membership:member:attach', (form, id) => ({ member: id ?? '', file: forms.store(form, 'file', 'profile', id ?? '') }), attach),
      },
    },
    files: { allows: opens },
  },
}
