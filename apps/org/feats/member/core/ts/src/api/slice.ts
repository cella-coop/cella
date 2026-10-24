import { action, type Slice } from '@cella/org-db'
import { profile } from '../handlers/index.ts'
import { member, members } from '../drivers/member.ts'

// The feat's server side as the shell mounts it: the members collection,
// read from its schema, and the profile write on a member's page.
export const slice: Slice = {
  name: 'member',
  collections: {
    members: {
      list: members,
      item: member,
      index: async (db) => (await members(db)).map((m) => ({ id: m.id, title: m.name, sub: m.status })),
      actions: {
        profile: action('member:member:profile', (form, id) => ({ member: id ?? '', name: form.get('name') || undefined }), profile),
      },
    },
  },
}
