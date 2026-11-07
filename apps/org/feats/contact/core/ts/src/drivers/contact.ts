import type { Db, Read } from '@cella/org-db'
import type { Contact } from '../models/contact.ts'

const columns = 'id, kind, name, form, email, phone, parent, tags, note, client, archived'

// The contacts not archived as the collection lists them, by name, each
// form as its column shows it: the contact's kind where it has none. Its
// client stage is null for a contact that is no client, which the Clients
// view leaves out.
export const listing: Read = {
  sql: `SELECT id, kind, name, coalesce(form, kind) AS form, email, phone, parent, tags, note, client, circle
        FROM contact.contact WHERE NOT archived`,
  order: 'name',
}

// Every contact not archived, by name.
export async function contacts(db: Db): Promise<Contact[]> {
  const { rows } = await db.query<Contact>(`SELECT ${columns} FROM contact.contact WHERE NOT archived ORDER BY name`)
  return rows
}

export async function contact(db: Db, id: string): Promise<Contact | null> {
  const { rows } = await db.query<Contact>(`SELECT ${columns} FROM contact.contact WHERE id = $1`, [id])
  return rows[0] ?? null
}
