import type { Db } from '@cella/org-db'
import type { Ask } from '../models/inbox.ts'

// What waits on a member that this feat knows: their invitation, while
// they are invited, to take up on their page's Joining tab.
export async function inbox(db: Db, actor: string | null): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'invitation/' || m.address AS id, 'invitation' AS kind,
            'Take up your invitation to join' AS what, 'your membership' AS about,
            to_char(m.invited, 'YYYY-MM-DD') AS since, NULL AS due,
            '/members/' || m.address || '?tab=joining' AS href
     FROM member.member m WHERE m.address = $1 AND m.status = 'invited'`,
    [actor],
  )
  return rows
}
