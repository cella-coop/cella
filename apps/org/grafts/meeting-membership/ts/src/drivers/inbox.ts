import type { Read } from '@cella/org-db'

// The meetings waiting on the acting member: each one still scheduled,
// from today on, that they are expected at, seated in its circle, and have
// not said whether they will come; the soonest first.
export const meetings: Read = {
  sql: `SELECT 'meeting/' || m.id AS id, 'meeting' AS kind, 'Say whether you will come: ' || m.title AS what,
               m.circle AS about, to_char(coalesce(m.scheduled, m.at::date), 'YYYY-MM-DD') AS since,
               to_char(m.at, 'YYYY-MM-DD') AS due, '/meetings/' || m.id AS href, m.at
        FROM meeting_membership.roll r
        JOIN meeting.meeting m ON m.id = r.meeting AND m.status = 'scheduled' AND m.at::date >= cella.verdict_date()
        WHERE r.member = cella.reader() AND r.seated AND r.status IS NULL`,
  order: 'at',
}
