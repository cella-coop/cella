// The graft's reads, and its slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { approve, submit } from '@cella/org-timesheet/api'
import type { Period } from '@cella/org-timesheet/models'
import { months, whose } from '../drivers/sheet.ts'

export { months, whose } from '../drivers/sheet.ts'

const period = (form: Form, worker: string | undefined): Period => {
  const month = form.get('month')
  if (!worker || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('a timesheet is a worker’s month, YYYY-MM')
  }
  return { member: worker, month }
}

// Whose each entry is; a worker's months on their page, submitting their
// own and approving someone else's, by the timesheet feat's writes.
export const slice: Slice = {
  name: 'employment-timesheet',
  extends: {
    timesheets: {
      list: whose,
    },
    people: {
      item: months,
      actions: {
        submit: action('timesheet:period:submit', (form, id) => period(form, id), submit),
        approve: action('timesheet:period:approve', (form, id) => period(form, id), approve),
      },
    },
  },
}
