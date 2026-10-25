import type { Db } from '@cella/org-db'
import type { Attended, Mark } from '../models/attendance.ts'

// The marks at a meeting, by member name.
export async function marks(db: Db, meeting: string): Promise<Mark[]> {
  const { rows } = await db.query<Mark>(
    `SELECT a.member, coalesce(mp.name, a.member) AS name, a.status, to_char(a.marked, 'YYYY-MM-DD') AS marked, a.by
     FROM meeting_membership.attendance a LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = a.member
     WHERE a.meeting = $1 ORDER BY name`,
    [meeting],
  )
  return rows
}

// How many were marked present at each meeting.
export const present = `SELECT meeting AS id, count(*)::int AS present FROM meeting_membership.attendance WHERE status = 'present' GROUP BY meeting`

// The meetings a member was marked at, the latest first.
export async function attended(db: Db, member: string): Promise<Attended[]> {
  const { rows } = await db.query<Attended>(
    `SELECT a.meeting, m.title, to_char(m.at, 'YYYY-MM-DD"T"HH24:MI') AS at, a.status
     FROM meeting_membership.attendance a JOIN meeting.meeting m ON m.id = a.meeting
     WHERE a.member = $1 ORDER BY m.at DESC`,
    [member],
  )
  return rows
}
