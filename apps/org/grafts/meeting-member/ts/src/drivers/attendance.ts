import type { Db } from '@cella/org-db'
import type { Attended, Mark } from '../models/attendance.ts'

// The marks at a meeting, by member name.
export async function marks(db: Db, meeting: string): Promise<Mark[]> {
  const { rows } = await db.query<Mark>(
    `SELECT a.member, coalesce(m.name, a.member) AS name, a.status, to_char(a.marked, 'YYYY-MM-DD') AS marked, a.by
     FROM meeting_member.attendance a LEFT JOIN member.member m ON m.address = a.member
     WHERE a.meeting = $1 ORDER BY name`,
    [meeting],
  )
  return rows
}

// How many were marked present at each meeting.
export async function present(db: Db): Promise<Record<string, { present: number }>> {
  const { rows } = await db.query<{ meeting: string; present: number }>(
    `SELECT meeting, count(*)::int AS present FROM meeting_member.attendance WHERE status = 'present' GROUP BY meeting`,
  )
  return Object.fromEntries(rows.map((r) => [r.meeting, { present: r.present }]))
}

// The meetings a member was marked at, the latest first.
export async function attended(db: Db, member: string): Promise<Attended[]> {
  const { rows } = await db.query<Attended>(
    `SELECT a.meeting, m.title, to_char(m.at, 'YYYY-MM-DD"T"HH24:MI') AS at, a.status
     FROM meeting_member.attendance a JOIN meeting.meeting m ON m.id = a.meeting
     WHERE a.member = $1 ORDER BY m.at DESC`,
    [member],
  )
  return rows
}
