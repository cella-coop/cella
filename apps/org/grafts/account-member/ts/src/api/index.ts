// The graft's reads and its slice, which the shell mounts: each member's
// capital, on the members list and their page, with their own statements
// of the work share for themselves and the statutes' terms read back as
// what they own and what joining asks; who holds each capital account in the
// chart; and whose each statement is, by name. Opening a capital account
// and freezing it are this graft's triggers, in the writes that admit and
// end a membership.
import type { Slice } from '@cella/org-db'
import { holders, named, rights, subscribed } from '../drivers/capital.ts'

export { capital, held, holders, named, owed, rights, statutes, subscribed } from '../drivers/capital.ts'
export type { Capital, Held, Owed, Rights, Statutes } from '../models/capital.ts'

export const slice: Slice = {
  name: 'account-member',
  extends: {
    members: { list: subscribed, item: rights },
    accounts: { list: holders },
    statements: { item: named },
  },
}
