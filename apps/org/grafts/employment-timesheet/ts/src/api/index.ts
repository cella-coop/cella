// The graft's reads, and its slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { approve, submit } from '@cella/org-timesheet/api'
import type { Period } from '@cella/org-timesheet/models'
import { months, whose } from '../drivers/sheet.ts'

export { months, whose } from '../drivers/sheet.ts'

// The month a form names as a row of the worker's months keys it: its
// month and its circle, `YYYY-MM/<circle>`.
const period = (form: Form, worker: string | undefined): Period => {
  const named = /^(\d{4}-\d{2})\/(.+)$/.exec(form.get('month'))
  if (!worker || !named) {
    throw new Error('a timesheet is a worker’s month in a circle, YYYY-MM/<circle>')
  }
  return { member: worker, month: named[1], circle: named[2] }
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
