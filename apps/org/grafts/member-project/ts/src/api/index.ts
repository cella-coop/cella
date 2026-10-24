// The graft's writes, POST /api/member-project/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-project/api'
import { share } from '../handlers/share.ts'
import { held, pot, shared } from '../drivers/share.ts'

export { share } from '../handlers/share.ts'
export { held, pot, shared } from '../drivers/share.ts'

// A project's pot, its shares and granting one; a member's shares.
export const slice: Slice = {
  name: 'member-project',
  extends: {
    projects: {
      list: shared,
      item: pot,
      actions: {
        share: action(
          'member-project:project:share',
          (form, id) => ({ project: id ?? '', member: form.get('member'), amount: forms.cents(form.get('amount')) }),
          share,
        ),
      },
    },
    members: {
      item: held,
    },
  },
}
