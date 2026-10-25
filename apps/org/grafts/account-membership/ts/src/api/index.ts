// The graft's reads and its slice, which the shell mounts: each member's
// capital, on the members list and their page, with the statutes' capital
// clauses read back as what they own and what joining asks; and who holds
// each capital account in the chart. Opening a capital account and
// freezing it are this graft's triggers, in the writes that admit and end
// a membership.
import type { Slice } from '@cella/org-db'
import { holders, rights, subscribed } from '../drivers/capital.ts'

export { capital, holders, rights, statutes, subscribed } from '../drivers/capital.ts'
export type { Capital, Rights, Statutes } from '../models/capital.ts'

export const slice: Slice = {
  name: 'account-membership',
  extends: {
    people: { list: subscribed, item: rights },
    accounts: { list: holders },
  },
}
