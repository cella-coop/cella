import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // project-timesheet's booking, by every employee's right rather than a
  // mandate: entries add up in any order; the worker's own, while employed
  'employment-project-timesheet:entry:book': confluent({ power: 'log-own-time' }),
} satisfies Actions
