import type { Db } from '@cella/org-db'
import type { Run } from '../models/run.ts'

const columns = `r.id, r.kind, r.name, r.actor, to_char(r.day, 'YYYY-MM-DD') AS day, r.dry, r.settled, r.refused, r.lines`

// Every import, the latest first.
export async function runs(db: Db): Promise<Run[]> {
  const { rows } = await db.query<Run>(`SELECT ${columns} FROM import.run r ORDER BY r.day DESC, r.id DESC`)
  return rows
}

export async function run(db: Db, id: string): Promise<Run | null> {
  const { rows } = await db.query<Run>(`SELECT ${columns} FROM import.run r WHERE r.id = $1`, [id])
  return rows[0] ?? null
}
