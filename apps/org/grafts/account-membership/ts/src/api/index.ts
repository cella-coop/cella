// The graft's reads, its reaction and its slice, which the shell mounts:
// each member's capital, on the members list and their page, with the
// statutes' capital clauses read back as what they own and what joining
// asks; who holds each capital account in the chart; and, once a member
// leaves, their capital accounts frozen by the write that follows their
// exclusion or withdrawal.
import type { Slice } from '@cella/org-db'
import { holders, rights, subscribed } from '../drivers/capital.ts'
import { frozen, frozenOwn } from '../handlers/freeze.ts'

export { capital, holders, rights, statutes, subscribed } from '../drivers/capital.ts'
export { frozen, frozenOwn } from '../handlers/freeze.ts'
export type { Capital, Rights, Statutes } from '../models/capital.ts'

export const slice: Slice = {
  name: 'account-membership',
  extends: {
    people: { list: subscribed, item: rights },
    accounts: { list: holders },
  },
  on: {
    'membership:member:exclude': frozen,
    'membership:member:withdraw': frozenOwn,
  },
}
