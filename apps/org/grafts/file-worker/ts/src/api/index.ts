// The graft's write, read and slice, which the shell mounts: on a
// worker's page the records on their file, and another filed; whoever hires files them.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-file/api'
import { attach } from '../handlers/index.ts'
import { records } from '../drivers/record.ts'

export { attach } from '../handlers/index.ts'
export { records } from '../drivers/record.ts'

export const slice: Slice = {
  name: 'file-worker',
  extends: {
    workers: {
      item: async (db, id) => ({ records: await records(db, id) }),
      actions: {
        file: action('file-worker:worker:attach', (form, id) => ({ worker: id ?? '', file: forms.store(form, 'file', 'payroll', id ?? '') }), attach),
      },
    },
  },
}
