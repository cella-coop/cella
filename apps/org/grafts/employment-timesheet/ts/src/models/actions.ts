import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the timesheet feat's log, by every employee's right rather than a
  // mandate: entries add up in any order; the worker's own, while employed
  'employment-timesheet:entry:log': confluent({ power: 'log-own-time' }),
  // the timesheet feat's correction, the same way: the worker's own entry,
  // lowered while its month is not approved
  'employment-timesheet:entry:correct': confluent({ power: 'log-own-time' }),
  // the timesheet feat's submit, the same way: a flag the worker sets on
  // their own month; submitting again changes nothing
  'employment-timesheet:period:submit': confluent({ power: 'log-own-time' }),
} satisfies Actions
