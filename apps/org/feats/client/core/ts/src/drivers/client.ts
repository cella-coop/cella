import type { Db } from '@cella/org-db'
import type { Client } from '../models/client.ts'

const columns = 'id, kind, name, form, email, phone, parent, tags, note, status'

// Every client not archived, by name.
export async function clients(db: Db): Promise<Client[]> {
  const { rows } = await db.query<Client>(`SELECT ${columns} FROM client.client WHERE status <> 'archived' ORDER BY name`)
  return rows
}

export async function client(db: Db, id: string): Promise<Client | null> {
  const { rows } = await db.query<Client>(`SELECT ${columns} FROM client.client WHERE id = $1`, [id])
  return rows[0] ?? null
}
