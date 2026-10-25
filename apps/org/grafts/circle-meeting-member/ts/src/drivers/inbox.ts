import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-member/models'

// The meetings waiting on a member: each one still scheduled, from today
// on, that they are expected at, seated in its circle, and have not said
// whether they will come.
export async function meetings(db: Db, actor: string | null, today = new Date().toISOString().slice(0, 10)): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'meeting/' || m.id AS id, 'meeting' AS kind, 'Say whether you will come: ' || m.title AS what,
            m.circle AS about, to_char(coalesce(m.scheduled, m.at::date), 'YYYY-MM-DD') AS since,
            to_char(m.at, 'YYYY-MM-DD') AS due, '/meetings/' || m.id AS href
     FROM circle_meeting_member.roll r
     JOIN meeting.meeting m ON m.id = r.meeting AND m.status = 'scheduled' AND m.at::date >= $2::date
     WHERE r.member = $1 AND r.seated AND r.status IS NULL
     ORDER BY m.at`,
    [actor, today],
  )
  return rows
}
