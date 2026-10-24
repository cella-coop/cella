// The graft's reads and its slice, which the shell mounts: each member's
// capital, on the members list and their page, and who holds each capital
// account in the chart. Opening a capital account and freezing it are
// this graft's triggers, in the writes that admit and end a membership.
import type { Slice } from '@cella/org-db'
import { capital, holders, subscribed } from '../drivers/capital.ts'

export { capital, holders, subscribed } from '../drivers/capital.ts'
export type { Capital } from '../models/capital.ts'

export const slice: Slice = {
  name: 'account-member',
  extends: {
    members: { list: subscribed, item: capital },
    accounts: { list: holders },
  },
}
