import { numbered, type Db } from '@cella/org-db'
import type { OnFile } from '../models/record.ts'

// The records on a worker's file, the first filed first.
export async function records(db: Db, worker: string): Promise<OnFile[]> {
  const { rows } = await db.query<OnFile>(
    `SELECT f.id, f.name, f.type, f.size, to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded, f.uploader
     FROM employment_file.record r JOIN file.file f ON f.id = r.file
     WHERE r.worker = $1 ORDER BY ${numbered('f.id')}`,
    [worker],
  )
  return rows
}
