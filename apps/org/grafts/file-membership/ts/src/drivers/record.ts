import type { Db } from '@cella/org-db'
import type { OnFile } from '../models/record.ts'

// The records on a member's file, the first filed first.
export async function records(db: Db, member: string): Promise<OnFile[]> {
  const { rows } = await db.query<OnFile>(
    `SELECT f.id, f.name, f.type, f.size, to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded, f.uploader
     FROM file_membership.record r JOIN file.file f ON f.id = r.file
     WHERE r.member = $1 ORDER BY f.id`,
    [member],
  )
  return rows
}
