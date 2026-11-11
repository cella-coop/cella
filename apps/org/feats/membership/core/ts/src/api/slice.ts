import { action, type Slice } from '@cella/org-db'
import { devices } from '@cella/org-person/api'
import { erase, invite, link, withdraw } from '../handlers/index.ts'
import { first, links, member, memberships } from '../drivers/member.ts'
import { inbox } from '../drivers/inbox.ts'
import { members as importing } from './imports.ts'

// The feat's server side as the shell mounts it, on core's
// collections: on each person the membership they hold, an invitation
// with its link as the people collection's New form, and on a person's
// page their membership, whether they have taken up their invitation, and
// a new link while they have not. Taking it up is the link's page's, in
// the shell, through `accept`. A member withdraws from their own page,
// and once they have left erases their data there,
// by their right. Admission, suspension and exclusion are decided,
// carried out when their motion closes. In the inbox, the acting
// person's invitation while they are invited; and members imported from
// another tool's list, each invited, to be given a link from their page.
export const slice: Slice = {
  name: 'membership',
  imports: { members: importing },
  extends: {
    people: {
      list: memberships,
      item: async (db, address, actor) => ({
        member: await member(db, address),
        first: await first(db, address),
        links: await links(db, address),
        devices: await devices(db, address),
        own: actor === address,
      }),
      actions: {
        invite: action(
          'membership:member:invite',
          (form) => ({ address: form.get('address').trim(), name: form.get('name').trim(), link: form.get('link') || undefined }),
          invite,
        ),
        link: action('membership:member:link', (form, id) => ({ member: id ?? '', link: form.get('link') }), link),
        withdraw: action('membership:member:withdraw', (_form, id) => ({ member: id ?? '' }), withdraw),
        erase: action('membership:member:erase', (_form, id) => ({ member: id ?? '' }), erase),
      },
    },
    inbox: { rows: inbox },
  },
}
