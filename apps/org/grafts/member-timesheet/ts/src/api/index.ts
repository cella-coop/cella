// The graft's reads and its slice, which the shell mounts. Its writes are
// the timesheet feat's, made from a member's page for that member's
// months.
import { action, type Form, type Slice } from '@cella/org-db'
import { approve, submit } from '@cella/org-timesheet/api'
import type { Period } from '@cella/org-timesheet/models'
import { months } from '../drivers/sheet.ts'

export { months } from '../drivers/sheet.ts'

const period = (form: Form, member: string | undefined): Period => {
  const month = form.get('month')
  if (!member || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('a timesheet is a member’s month, YYYY-MM')
  }
  return { member, month }
}

// A member's months, and submitting or approving one from their page.
// Whose each entry is, a worker's, is timesheet-worker's.
export const slice: Slice = {
  name: 'member-timesheet',
  extends: {
    members: {
      item: months,
      actions: {
        submit: action('timesheet:period:submit', (form, id) => period(form, id), submit),
        approve: action('timesheet:period:approve', (form, id) => period(form, id), approve),
      },
    },
  },
}
