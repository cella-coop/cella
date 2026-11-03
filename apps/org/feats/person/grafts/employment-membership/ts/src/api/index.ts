// The graft's write, POST /api/employment-membership/<op> once the server exists,
// its reads, its reaction and its slice, which the shell mounts.
import type { Slice } from '@cella/org-db'
import { opened } from '../handlers/open.ts'
import { path, stages } from '../drivers/path.ts'

export { open, opened } from '../handlers/open.ts'
export { path, stages } from '../drivers/path.ts'

// Each person's stage on their way to membership; on their page, the
// path they took; and, once an employee applies, their candidacy, opened
// by the write that follows the application.
export const slice: Slice = {
  name: 'employment-membership',
  extends: {
    people: {
      list: stages,
      item: (db, address) => path(db, address),
    },
  },
  on: {
    'membership:member:apply': opened,
  },
}
