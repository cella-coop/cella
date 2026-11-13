// The graft's reads, its write, which is the timesheet feat's log with
// the entry booked to a project, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-timesheet/api'
import { book } from '../handlers/book.ts'
import { burns, projectOf, time } from '../drivers/booking.ts'
import { contract } from './contract.ts'

export { book, booking, type Booked } from '../handlers/book.ts'
export { burns, projectOf, time } from '../drivers/booking.ts'

// Each entry's project; each project's time, what it spent of the
// budget, and logging time against it from its page.
export const slice: Slice = {
  name: 'project-timesheet',
  queries: contract,
  extends: {
    timesheets: {
      list: projectOf,
    },
    projects: {
      list: burns,
      item: time,
      actions: {
        log: action('timesheet:entry:log', (form, id, deps) => ({ ...forms.log(form, deps.actor), project: id ?? '' }), book),
      },
    },
  },
}
