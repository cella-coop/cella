import type { Read } from '@cella/org-db'

// The stances waiting on the acting member: each open motion whose roll
// they are on, active, that they have given no stance on yet, by its
// deadline.
export const stances: Read = {
  sql: `SELECT 'stance/' || d.id AS id, 'stance' AS kind, d.title AS what, d.id || ' · ' || p.label AS about,
               to_char(d.proposed, 'YYYY-MM-DD') AS since, to_char(d.deadline, 'YYYY-MM-DD') AS due,
               '/motions/' || d.id || '?tab=stances' AS href
        FROM circle_membership_motion.roll r
        JOIN motion.motion d ON d.id = r.motion AND d.closed IS NULL
        JOIN motion.procedure p ON p.id = d.procedure
        WHERE r.member = cella.reader() AND membership.active(r.member, cella.verdict_date())
          AND NOT EXISTS (SELECT FROM motion.vote v WHERE v.motion = d.id AND v.member = r.member)`,
  order: 'due, id',
}
