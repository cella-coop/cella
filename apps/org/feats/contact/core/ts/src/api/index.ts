// The feat's public writes, POST /api/contact/<op> once the server exists,
// its reads, its import of contacts from another tool, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { update } from '../handlers/index.ts'
import { contact, contacts, listing } from '../drivers/contact.ts'
import { contacts as imported } from './imports.ts'

export { add, archive, erase, update } from '../handlers/index.ts'
export { contact, contacts } from '../drivers/contact.ts'

export const slice: Slice = {
  name: 'contact',
  imports: { contacts: imported },
  collections: {
    contacts: {
      list: listing,
      item: contact,
      index: async (db) => (await contacts(db)).map((c) => ({ id: c.id, title: c.name, sub: c.form ?? c.kind })),
      actions: {
        note: action('contact:contact:update', (form, id) => ({ id: id ?? '', fields: { note: form.get('note') } }), update),
      },
    },
  },
}
