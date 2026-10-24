import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // entries add up in any order; the member's own, into a period not yet
  // approved
  'timesheet:entry:log': confluent({ power: 'log-time' }),
  // a flag the member sets on their own period; submitting again changes
  // nothing
  'timesheet:period:submit': confluent({ power: 'log-time' }),
  // closes the period to new entries: ordered against the logs, it fixes
  // which entries were approved; never one's own
  'timesheet:period:approve': ordered({ power: 'approve-time' }),
} satisfies Ops
