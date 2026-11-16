// The graft's writes, POST /api/membership-project/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, cents, type Slice } from '@cella/org-db'
import { crew } from '../handlers/crew.ts'
import { share } from '../handlers/share.ts'
import { held, pot, shared } from '../drivers/share.ts'
import { contract } from './contract.ts'

export { crew } from '../handlers/crew.ts'
export { share } from '../handlers/share.ts'
export { held, pot, shared } from '../drivers/share.ts'

// What a comma-separated field of addresses names, each trimmed, empty
// ones dropped.
const addresses = (typed: string) =>
  typed
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

// A project's pot, its shares and granting one, its crew and setting it;
// a member's shares.
export const slice: Slice = {
  name: 'membership-project',
  queries: contract,
  extends: {
    projects: {
      list: shared,
      item: pot,
      actions: {
        share: action(
          'membership-project:project:share',
          (form, id) => ({ project: id ?? '', member: form.get('member'), amount: cents(form.get('amount')) }),
          share,
        ),
        crew: action(
          'membership-project:project:crew',
          (form, id) => ({ project: id ?? '', lead: form.get('lead') || null, members: addresses(form.get('members')) }),
          crew,
        ),
      },
    },
    people: {
      item: held,
    },
  },
}
