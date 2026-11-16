import type { Db } from '@cella/org-db'
import type { Assigned } from '../models/assignment.ts'

// Who does each task, by task: the assignee's name, which a board may
// group by, and their address, by which their page jumps to their tasks.
export const assignees =
  'SELECT a.task AS id, mp.name AS assignee, a.member AS assigned FROM membership_task.assignment a JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = a.member'

export async function assigned(db: Db, task: string): Promise<Assigned> {
  const { rows } = await db.query<{ address: string; name: string }>(
    'SELECT m.address, mp.name FROM membership_task.assignment a JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = a.member WHERE a.task = $1',
    [task],
  )
  const { rows: members } = await db.query<{ address: string; name: string }>(
    `SELECT m.address, p.name FROM membership.member m JOIN person.person p ON p.address = m.address WHERE membership.active(m.address, cella.verdict_date()) ORDER BY p.name`,
  )
  return { assignee: rows[0] ?? null, members }
}
