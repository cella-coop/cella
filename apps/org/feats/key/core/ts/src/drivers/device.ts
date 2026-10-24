import type { Db } from '@cella/org-db'
import type { Device } from '../models/key.ts'

// Every device, or one address's, current ones first.
export async function devices(db: Db, address?: string): Promise<Device[]> {
  const { rows } = await db.query<Device>(
    `SELECT encode(key, 'hex') AS id, encode(key, 'hex') AS key, address, label,
            to_char(enrolled, 'YYYY-MM-DD') AS enrolled, to_char(revoked, 'YYYY-MM-DD') AS revoked
     FROM key.device
     WHERE $1::text IS NULL OR address = $1
     ORDER BY revoked IS NOT NULL, address, enrolled, label`,
    [address ?? null],
  )
  return rows
}
