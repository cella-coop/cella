import { numbered, type Db, type Read } from '@cella/org-db'
import type { Run } from '../models/run.ts'

const columns = (dry: string) => `r.id, r.kind, r.name, r.actor, to_char(r.day, 'YYYY-MM-DD') AS day, ${dry} AS dry, r.settled, r.refused, r.lines`

// The imports as the collection lists them, the latest first, each run
// as its badge shows it.
export const listing: Read = {
  sql: `SELECT ${columns(`CASE WHEN r.dry THEN 'dry run' ELSE 'imported' END`)} FROM import.run r`,
  order: `day DESC, ${numbered('id', 'DESC')}`,
}

// Every import, the latest first.
export async function runs(db: Db): Promise<Run[]> {
  const { rows } = await db.query<Run>(`SELECT ${columns('r.dry')} FROM import.run r ORDER BY r.day DESC, ${numbered('r.id', 'DESC')}`)
  return rows
}

export async function run(db: Db, id: string): Promise<Run | null> {
  const { rows } = await db.query<Run>(`SELECT ${columns('r.dry')} FROM import.run r WHERE r.id = $1`, [id])
  return rows[0] ?? null
}
