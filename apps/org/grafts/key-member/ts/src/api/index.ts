// The graft's write, its reads and its slice, which the shell mounts: the
// invitation that carries a first device, replacing the member feat's,
// and on a member's page that device and every one enrolled under their
// address.
import { action, type Slice } from '@cella/org-db'
import { devices } from '@cella/org-key/api'
import { invite } from '../handlers/invite.ts'
import { first } from '../drivers/invitation.ts'

export { invite } from '../handlers/invite.ts'
export { first } from '../drivers/invitation.ts'

export const slice: Slice = {
  name: 'key-member',
  extends: {
    members: {
      item: async (db, member) => ({ first: await first(db, member), devices: await devices(db, member) }),
      actions: {
        invite: action(
          'member:member:invite',
          (form) => ({
            address: form.get('address').trim(),
            name: form.get('name').trim(),
            key: form.get('key'),
            label: form.get('label').trim(),
          }),
          invite,
        ),
      },
    },
  },
}
