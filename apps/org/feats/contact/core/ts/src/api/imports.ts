import { csv, type Importer } from '@cella/org-db'
import { add } from '../handlers/index.ts'
import type { Kind } from '../models/contact.ts'

// A contact's id from its name, as the URL names it.
const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// Contacts from another tool's list, a CSV with a header naming `name`
// and, if it has them, `kind` (company or person), `form`, `email`,
// `phone`, `tags` (separated by | or ;) and `note`: each added as the
// importing member, under their power to edit contacts. One the co-op
// holds already, by its name, is refused. A person among them is a core
// person, known by their email as their address, so a line naming a
// person with no email is refused; their details are personal data, as
// a contact added by hand is, and a line is labelled by a company's id,
// a person's never.
export const contacts: Importer = {
  title: 'Contacts',
  formats: 'CSV with the columns name, and kind, form, email, phone, tags and note if it has them',
  read: async (text, db) => {
    const { rows: held } = await db.query<{ id: string; name: string }>('SELECT id, name FROM contact.named')
    return csv(text).map(({ line, fields }) => {
      const name = (fields.name ?? '').trim()
      const kind: Kind = /^(person|particulier|individual)$/i.test(fields.kind ?? '') ? 'person' : 'company'
      const id = slug(name)
      const label = kind === 'person' ? `a person, line ${line}` : id
      if (!id) {
        return { line, label: `line ${line}`, op: 'contact:contact:add', refused: 'a contact needs a name' }
      }
      const same = held.find((c) => c.id === id || slug(c.name ?? '') === id)
      if (same) {
        return { line, label, op: 'contact:contact:add', refused: `the co-op holds this contact already, as ${same.id}` }
      }
      const email = (fields.email ?? '').trim() || null
      if (kind === 'person' && !email) {
        return { line, label, op: 'contact:contact:add', refused: 'a person is known by an address: give their email' }
      }
      const tags = (fields.tags ?? '').split(/[|;]/).map((t) => t.trim()).filter(Boolean)
      const input = {
        id,
        name,
        kind,
        ...(kind === 'person' && email ? { person: email } : {}),
        form: fields.form || null,
        email,
        phone: fields.phone || null,
        tags,
        note: fields.note ?? '',
      }
      return { line, label, op: 'contact:contact:add', run: (deps) => add(input, deps) }
    })
  },
}
