import type { Db, Read } from '@cella/org-db'
import type { Device } from '../models/device.ts'

// A device's state is current until it is revoked.
const columns = `encode(key, 'hex') AS id, encode(key, 'hex') AS key, address, label,
  to_char(enrolled, 'YYYY-MM-DD') AS enrolled, to_char(revoked, 'YYYY-MM-DD') AS revoked,
  CASE WHEN revoked IS NULL THEN 'current' ELSE 'revoked' END AS state`

// Every device as the collection lists them, current ones first.
export const listing: Read = {
  sql: `SELECT ${columns} FROM person.device`,
  order: 'revoked IS NOT NULL, address, enrolled, label',
}

// Every device, or one address's, current ones first.
export async function devices(db: Db, address?: string): Promise<Device[]> {
  const { rows } = await db.query<Device>(
    `SELECT ${columns}
     FROM person.device
     WHERE $1::text IS NULL OR address = $1
     ORDER BY revoked IS NOT NULL, address, enrolled, label`,
    [address ?? null],
  )
  return rows
}
