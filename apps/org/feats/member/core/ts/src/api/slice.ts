import { action, type Slice } from '@cella/org-db'
import { invite, profile } from '../handlers/index.ts'
import { member, members } from '../drivers/member.ts'

// The feat's server side as the shell mounts it: the members collection,
// read from its schema, an invitation, which key-member replaces with one
// carrying the invitee's first device, and the profile write on a
// member's page. Suspension and exit are decided, carried out when their
// decision closes.
export const slice: Slice = {
  name: 'member',
  collections: {
    members: {
      list: members,
      item: member,
      index: async (db) => (await members(db)).map((m) => ({ id: m.id, title: m.name, sub: m.status })),
      actions: {
        invite: action('member:member:invite', (form) => ({ address: form.get('address').trim(), name: form.get('name').trim() }), invite),
        profile: action('member:member:profile', (form, id) => ({ member: id ?? '', name: form.get('name') || undefined }), profile),
      },
    },
  },
}
