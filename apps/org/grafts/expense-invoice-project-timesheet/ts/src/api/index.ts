// The graft's reads and slice, which the shell mounts: each project's
// margin, its budget burn and forecast, and whether it is watched, and
// how many are.
import type { Slice } from '@cella/org-db'
import { listing, marginOf, watched } from '../drivers/margin.ts'

export { listing, margins, marginOf, watched } from '../drivers/margin.ts'

export const slice: Slice = {
  name: 'expense-invoice-project-timesheet',
  extends: {
    projects: { list: listing, about: watched, item: (db, id) => marginOf(db, id) },
  },
}
