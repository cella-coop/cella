import { ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // the founding, the log's first entry, before any policy grants a power
  'membership-motion:scope:found': ordered({ check: 'first' }),
} satisfies Actions
