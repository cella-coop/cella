import type { Db, Read } from '@cella/org-db'
import { b64, type Canon } from '@cella/org-body/models'
import type { Page, Task } from '../models/task.ts'
import { comments, discusses, reacting, readers } from './comment.ts'

const columns = `id, title, status, priority, to_char(due, 'YYYY-MM-DD') AS due,
  to_char(created, 'YYYY-MM-DD') AS created, to_char(completed, 'YYYY-MM-DD') AS completed`

const order = `array_position(ARRAY['urgent', 'high', 'normal', 'low'], priority), due NULLS LAST, (substr(id, 3))::integer`

// The tasks as the collection lists them, the most pressing first.
export const listing: Read = { sql: `SELECT ${columns}, circle FROM task.task`, order }

// Every task, the most pressing first.
export async function tasks(db: Db): Promise<Task[]> {
  const { rows } = await db.query<Task>(`SELECT ${columns} FROM task.task ORDER BY ${order}`)
  return rows
}

export async function task(db: Db, id: string): Promise<Task | null> {
  const { rows } = await db.query<Task>(`SELECT ${columns} FROM task.task WHERE id = $1`, [id])
  return rows[0] ?? null
}

// A task as its page reads it, with its body and its threads, and
// whether their comments take reactions.
export async function page(db: Db, id: string): Promise<Page | null> {
  const { rows } = await db.query<Task & { body: Uint8Array | null; canon: string | null }>(
    `SELECT ${columns}, body, cella.document_canonical(body) AS canon FROM task.task WHERE id = $1`,
    [id],
  )
  const t = rows[0]
  if (!t) {
    return null
  }
  const { body, canon, ...rest } = t
  return {
    ...rest,
    snapshot: body ? b64.encode(new Uint8Array(body)) : null,
    canon: canon ? (JSON.parse(canon) as Canon) : null,
    comments: await comments(db, id),
    readers: await readers(db, id),
    discuss: await discusses(db, id),
    reactions: await reacting(db, id),
  }
}

// What core body's session reads of a task: its circle, and its saved
// body, as the reader sees them.
export async function circleOf(db: Db, id: string): Promise<string | null> {
  const { rows } = await db.query<{ circle: string }>('SELECT circle FROM task.task WHERE id = $1', [id])
  return rows[0]?.circle ?? null
}

export async function saved(db: Db, id: string): Promise<Uint8Array | null> {
  const { rows } = await db.query<{ body: Uint8Array | null }>('SELECT body FROM task.task WHERE id = $1', [id])
  return rows[0]?.body ? new Uint8Array(rows[0].body) : null
}
