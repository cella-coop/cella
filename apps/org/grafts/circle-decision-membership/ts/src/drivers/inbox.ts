import type { Read } from '@cella/org-db'

// The stances waiting on the acting member: each open decision whose roll
// they are on, active, that they have given no stance on yet, by its
// deadline.
export const stances: Read = {
  sql: `SELECT 'stance/' || d.id AS id, 'stance' AS kind, d.title AS what, d.id || ' · ' || p.label AS about,
               to_char(d.proposed, 'YYYY-MM-DD') AS since, to_char(d.deadline, 'YYYY-MM-DD') AS due,
               '/decisions/' || d.id || '?tab=stances' AS href
        FROM circle_decision_membership.roll r
        JOIN decision.decision d ON d.id = r.decision AND d.closed IS NULL
        JOIN decision.procedure p ON p.id = d.procedure
        JOIN membership.member m ON m.address = r.member AND m.status = 'active'
        WHERE r.member = cella.reader()
          AND NOT EXISTS (SELECT FROM decision.vote v WHERE v.decision = d.id AND v.member = r.member)`,
  order: 'due, id',
}
