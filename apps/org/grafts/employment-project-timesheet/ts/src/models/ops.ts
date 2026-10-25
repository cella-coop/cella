import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // project-timesheet's booking, by the worker's employment rather than a
  // mandate: entries add up in any order; the worker's own, while employed
  'employment-project-timesheet:entry:book': confluent({ check: 'self' }),
} satisfies Ops
