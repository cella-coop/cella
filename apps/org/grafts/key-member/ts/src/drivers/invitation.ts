import type { Db } from '@cella/org-db'
import type { First } from '../models/index.ts'

// The first device a member's invitation carried, and when their
// admission enrolled it, if it has.
export async function first(db: Db, member: string): Promise<First | null> {
  const { rows } = await db.query<First>(
    `SELECT encode(i.key, 'hex') AS key, i.label, to_char(d.enrolled, 'YYYY-MM-DD') AS enrolled
     FROM key_member.invitation i LEFT JOIN key.device d ON d.key = i.key
     WHERE i.member = $1`,
    [member],
  )
  return rows[0] ?? null
}
