import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-person/models'

// The stances waiting on a member: each open decision whose roll they are
// on, active, that they have given no stance on yet, by its deadline.
export async function stances(db: Db, actor: string | null): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'stance/' || d.id AS id, 'stance' AS kind, d.title AS what, d.id || ' · ' || p.label AS about,
            to_char(d.proposed, 'YYYY-MM-DD') AS since, to_char(d.deadline, 'YYYY-MM-DD') AS due,
            '/decisions/' || d.id || '?tab=stances' AS href
     FROM circle_decision_membership.roll r
     JOIN decision.decision d ON d.id = r.decision AND d.closed IS NULL
     JOIN decision.procedure p ON p.id = d.procedure
     JOIN membership.member m ON m.address = r.member AND m.status = 'active'
     WHERE r.member = $1
       AND NOT EXISTS (SELECT FROM decision.vote v WHERE v.decision = d.id AND v.member = r.member)
     ORDER BY d.deadline, d.id`,
    [actor],
  )
  return rows
}
