import type { Db } from '@cella/org-db'
import type { Text, Texts } from '../models/reading.ts'

// A member's texts to read, the latest adopted first, as `actor` sees
// them.
export async function texts(db: Db, member: string, actor: string | null): Promise<Texts> {
  const { rows } = await db.query<Text>(
    `SELECT version AS id, document, title, version, to_char(adopted, 'YYYY-MM-DD') AS adopted, to_char(read, 'YYYY-MM-DD') AS read
     FROM document_membership.texts WHERE member = $1 ORDER BY adopted DESC, document`,
    [member],
  )
  return { texts: rows, own: actor === member }
}
