// The graft's writes, POST /api/timesheet-worker/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { approve, forms } from '@cella/org-timesheet/api'
import type { Period } from '@cella/org-timesheet/models'
import { log, submit } from '../handlers/work.ts'
import { months, whose } from '../drivers/sheet.ts'

export { log, submit } from '../handlers/work.ts'
export { months, whose } from '../drivers/sheet.ts'

const period = (form: Form, worker: string | undefined): Period => {
  const month = form.get('month')
  if (!worker || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('a timesheet is a worker’s month, YYYY-MM')
  }
  return { member: worker, month }
}

// Whose each entry is, and logging and submitting one's own time by
// one's employment, which replace the timesheet feat's writes of the same
// name; a worker's months on their page, submitting their own and
// approving someone else's.
export const slice: Slice = {
  name: 'timesheet-worker',
  extends: {
    timesheets: {
      list: whose,
      actions: {
        log: action('timesheet-worker:entry:log', (form, _, deps) => forms.log(form, deps.actor), log),
        submit: action('timesheet-worker:period:submit', (_, id, deps) => forms.period(deps.db, id), submit),
      },
    },
    workers: {
      item: months,
      actions: {
        submit: action('timesheet-worker:period:submit', (form, id) => period(form, id), submit),
        approve: action('timesheet:period:approve', (form, id) => period(form, id), approve),
      },
    },
  },
}
