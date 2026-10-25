import { action, type Slice } from '@cella/org-db'
import { devices } from '@cella/org-person/api'
import { invite } from '../handlers/index.ts'
import { first, member, members } from '../drivers/member.ts'
import { inbox } from '../drivers/inbox.ts'
import { members as importing } from './imports.ts'

// The feat's server side as the shell mounts it, on its parent's
// collections: on each person the membership they hold, an invitation
// with its first device as the people collection's New form, and on a
// person's page their membership and the device joining asks. Admission,
// suspension and exit are decided, carried out when their decision closes.
// In the inbox, the acting person's invitation while they are invited; and
// members imported from another tool's list, each invited with their
// first device.
export const slice: Slice = {
  name: 'membership',
  within: 'person',
  imports: { members: importing },
  extends: {
    people: {
      list: async (db) => Object.fromEntries((await members(db)).map(({ id, status, since, shares }) => [id, { status, since, shares }])),
      item: async (db, address) => ({ member: await member(db, address), first: await first(db, address), devices: await devices(db, address) }),
      actions: {
        invite: action(
          'membership:member:invite',
          (form) => ({ address: form.get('address').trim(), name: form.get('name').trim(), key: form.get('key'), label: form.get('label').trim() }),
          invite,
        ),
      },
    },
    inbox: { rows: inbox },
  },
}
