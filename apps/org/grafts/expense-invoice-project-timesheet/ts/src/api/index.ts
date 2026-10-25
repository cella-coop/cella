// The graft's reads and slice, which the shell mounts: each project's
// margin, its budget burn and forecast, and whether it is watched.
import type { Slice } from '@cella/org-db'
import { margins, marginOf } from '../drivers/margin.ts'

export { margins, marginOf } from '../drivers/margin.ts'

export const slice: Slice = {
  name: 'expense-invoice-project-timesheet',
  extends: {
    projects: { list: margins, item: (db, id) => marginOf(db, id) },
  },
}
