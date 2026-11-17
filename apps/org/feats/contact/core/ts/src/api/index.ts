// The feat's public writes, POST /api/contact/<op> once the server exists,
// its reads, its import of contacts from another tool, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { update } from '../handlers/index.ts'
import { contact, contacts, listing } from '../drivers/contact.ts'
import { stages, type Stage } from '../models/contact.ts'
import { contacts as imported } from './imports.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount, withBody } from './body.ts'

export { add, archive, erase, update } from '../handlers/index.ts'
export { contact, contacts } from '../drivers/contact.ts'

// The client role a form names: a stage, or none when it is left empty.
function stage(typed: string): Stage | null {
  if (!typed) {
    return null
  }
  const s = stages.find((x) => x === typed)
  if (!s) {
    throw new Error(`“${typed}” is no stage of the client role: ${stages.join(', ')}, or none`)
  }
  return s
}
export { saveBody } from '../handlers/body.ts'

export const slice: Slice = {
  name: 'contact',
  queries: contract,
  imports: { contacts: imported },
  collections: {
    contacts: {
      list: listing,
      item: withBody(contact),
      index: async (db) => (await contacts(db)).map((c) => ({ id: c.id, title: c.name, sub: c.form ?? c.kind })),
      body: bodyMount,
      actions: {
        ...bodyActions,
        client: action('contact:contact:update', (form, id) => ({ id: id ?? '', fields: { client: stage(form.get('client')) } }), update),
        note: action('contact:contact:update', (form, id) => ({ id: id ?? '', fields: { note: form.get('note') } }), update),
      },
    },
  },
}
