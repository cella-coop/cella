import type { Read } from '@cella/org-db'

// What waits on a person that this feat knows: their invitation, while
// they are invited, to take up on their page's Joining tab.
export const inbox: Read = {
  sql: `SELECT 'invitation/' || m.address AS id, 'invitation' AS kind,
               'Take up your invitation to join' AS what, 'your membership' AS about,
               to_char(m.invited, 'YYYY-MM-DD') AS since, NULL AS due,
               '/people/' || m.address || '?tab=membership' AS href
        FROM membership.member m WHERE m.address = cella.reader() AND m.status = 'invited'`,
  order: 'id',
}
