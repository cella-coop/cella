import type { Db, Read } from '@cella/org-db'
import type { Person } from '../models/person.ts'

const columns = 'address AS id, address, name, email, phone'

// Everyone the co-op knows as the collection lists them, by name.
export const listing: Read = { sql: `SELECT ${columns} FROM person.person`, order: 'name' }

// Everyone the co-op knows, by name.
export async function people(db: Db): Promise<Person[]> {
  const { rows } = await db.query<Person>(`SELECT ${columns} FROM person.person ORDER BY name`)
  return rows
}

export async function person(db: Db, address: string): Promise<Person | null> {
  const { rows } = await db.query<Person>(`SELECT ${columns} FROM person.person WHERE address = $1`, [address])
  return rows[0] ?? null
}
