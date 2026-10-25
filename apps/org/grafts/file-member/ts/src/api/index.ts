// The graft's write, read and slice, which the shell mounts: on a
// member's page the records on their file, and another filed; a member files their own.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-file/api'
import { attach } from '../handlers/index.ts'
import { records } from '../drivers/record.ts'

export { attach } from '../handlers/index.ts'
export { records } from '../drivers/record.ts'

export const slice: Slice = {
  name: 'file-member',
  extends: {
    members: {
      item: async (db, id) => ({ records: await records(db, id) }),
      actions: {
        file: action('file-member:member:attach', (form, id) => ({ member: id ?? '', file: forms.store(form, 'file', 'member-profile', id ?? '') }), attach),
      },
    },
  },
}
