import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the timesheet feat's log, by the worker's employment rather than a
  // mandate: entries add up in any order; the worker's own, while employed
  'employment-timesheet:entry:log': confluent({ check: 'self' }),
  // the timesheet feat's correction, the same way: the worker's own entry,
  // lowered while its month is not approved
  'employment-timesheet:entry:correct': confluent({ check: 'self' }),
  // the timesheet feat's submit, the same way: a flag the worker sets on
  // their own month; submitting again changes nothing
  'employment-timesheet:period:submit': confluent({ check: 'self' }),
} satisfies Actions
