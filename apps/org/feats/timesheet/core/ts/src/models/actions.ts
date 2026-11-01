import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // entries add up in any order; the member's own, into a period not yet
  // approved
  'timesheet:entry:log': confluent({ power: 'log-time' }),
  // lowers the member's own entry, to none where none was worked, in a
  // period not yet approved: two corrections leave the lower in any order
  'timesheet:entry:correct': confluent({ power: 'log-time' }),
  // a flag the member sets on their own period; submitting again changes
  // nothing
  'timesheet:period:submit': confluent({ power: 'log-time' }),
  // closes the period to new entries: ordered against the logs, it fixes
  // which entries were approved; never one's own
  'timesheet:period:approve': ordered({ power: 'approve-time' }),
} satisfies Actions
