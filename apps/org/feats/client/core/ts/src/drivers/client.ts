import type { Db, Read } from '@cella/org-db'
import type { Client } from '../models/client.ts'

const columns = 'id, kind, name, form, email, phone, parent, tags, note, status'

// The clients not archived as the collection lists them, by name, each
// form as its column shows it: the client's kind where it has none.
export const listing: Read = {
  sql: `SELECT id, kind, name, coalesce(form, kind) AS form, email, phone, parent, tags, note, status
        FROM client.client WHERE status <> 'archived'`,
  order: 'name',
}

// Every client not archived, by name.
export async function clients(db: Db): Promise<Client[]> {
  const { rows } = await db.query<Client>(`SELECT ${columns} FROM client.client WHERE status <> 'archived' ORDER BY name`)
  return rows
}

export async function client(db: Db, id: string): Promise<Client | null> {
  const { rows } = await db.query<Client>(`SELECT ${columns} FROM client.client WHERE id = $1`, [id])
  return rows[0] ?? null
}
