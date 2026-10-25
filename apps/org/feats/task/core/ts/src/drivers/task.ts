import type { Db, Read } from '@cella/org-db'
import type { Task } from '../models/task.ts'

const columns = `id, title, status, priority, to_char(due, 'YYYY-MM-DD') AS due,
  to_char(created, 'YYYY-MM-DD') AS created, to_char(completed, 'YYYY-MM-DD') AS completed`

const order = `array_position(ARRAY['urgent', 'high', 'normal', 'low'], priority), due NULLS LAST, (substr(id, 3))::integer`

// The tasks as the collection lists them, the most pressing first.
export const listing: Read = { sql: `SELECT ${columns} FROM task.task`, order }

// Every task, the most pressing first.
export async function tasks(db: Db): Promise<Task[]> {
  const { rows } = await db.query<Task>(`SELECT ${columns} FROM task.task ORDER BY ${order}`)
  return rows
}

export async function task(db: Db, id: string): Promise<Task | null> {
  const { rows } = await db.query<Task>(`SELECT ${columns} FROM task.task WHERE id = $1`, [id])
  return rows[0] ?? null
}
