import type { Db } from '@cella/org-db'
import type { Assigned, Doing } from '../models/assignment.ts'

// Who does each task, by task: the assignee's name, which a board may
// group by.
export async function assignees(db: Db): Promise<Record<string, { assignee: string }>> {
  const { rows } = await db.query<{ task: string; name: string }>(
    'SELECT a.task, m.name FROM member_task.assignment a JOIN member.member m ON m.address = a.member',
  )
  return Object.fromEntries(rows.map((r) => [r.task, { assignee: r.name }]))
}

export async function assigned(db: Db, task: string): Promise<Assigned> {
  const { rows } = await db.query<{ address: string; name: string }>(
    'SELECT m.address, m.name FROM member_task.assignment a JOIN member.member m ON m.address = a.member WHERE a.task = $1',
    [task],
  )
  const { rows: members } = await db.query<{ address: string; name: string }>(
    `SELECT address, name FROM member.member WHERE status = 'active' ORDER BY name`,
  )
  return { assignee: rows[0] ?? null, members }
}

// The tasks a member does that are not done, the most pressing first.
export async function doing(db: Db, member: string): Promise<Doing[]> {
  const { rows } = await db.query<Doing>(
    `SELECT t.id, t.title, t.status, t.priority, to_char(t.due, 'YYYY-MM-DD') AS due
     FROM member_task.assignment a JOIN task.task t ON t.id = a.task
     WHERE a.member = $1 AND t.status <> 'done'
     ORDER BY array_position(ARRAY['urgent', 'high', 'normal', 'low'], t.priority), t.due NULLS LAST, t.id`,
    [member],
  )
  return rows
}
