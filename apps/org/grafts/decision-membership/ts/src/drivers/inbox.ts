import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-person/models'

// The mentions waiting on a member: each message on an open decision that
// mentions them, by someone else, which they have not answered by a
// message of their own on that decision since.
export async function mentions(db: Db, actor: string | null): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'mention/' || x.message AS id, 'mention' AS kind,
            coalesce(ap.name, x.author) || ' mentioned you on ' || d.title AS what, d.id AS about,
            to_char(x.at, 'YYYY-MM-DD') AS since, NULL AS due,
            '/decisions/' || d.id || '?tab=discussion' AS href
     FROM decision_membership.mention x
     JOIN decision.decision d ON d.id = x.decision AND d.closed IS NULL
     LEFT JOIN (membership.member a JOIN person.person ap ON ap.address = a.address) ON a.address = x.author
     WHERE x.member = $1 AND x.author <> $1
       AND NOT EXISTS (SELECT FROM decision.message y WHERE y.decision = x.decision AND y.member = $1 AND y.receipt > x.message)
     ORDER BY x.message`,
    [actor],
  )
  return rows
}
