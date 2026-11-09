// The graft's writes, POST /api/membership-project/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, cents, type Slice } from '@cella/org-db'
import { share } from '../handlers/share.ts'
import { held, pot, shared } from '../drivers/share.ts'
import { contract } from './contract.ts'

export { share } from '../handlers/share.ts'
export { held, pot, shared } from '../drivers/share.ts'

// A project's pot, its shares and granting one; a member's shares.
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
      },
    },
    people: {
      item: held,
    },
  },
}
