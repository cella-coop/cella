import type { Read } from '@cella/org-db'

// The mentions waiting on the acting member: each message on an open
// motion that mentions them, by someone else, which they have not
// answered by a message of their own on that motion since; in the order
// received.
export const mentions: Read = {
  sql: `SELECT 'mention/' || x.message AS id, 'mention' AS kind,
               coalesce(ap.name, x.author) || ' mentioned you on ' || d.title AS what, d.id AS about,
               to_char(x.at, 'YYYY-MM-DD') AS since, NULL::text AS due,
               '/motions/' || d.id AS href, x.message
        FROM membership_motion.mention x
        JOIN motion.motion d ON d.id = x.motion AND d.closed IS NULL
        LEFT JOIN (membership.member a JOIN person.person ap ON ap.address = a.address) ON a.address = x.author
        WHERE x.member = cella.reader() AND x.author <> cella.reader()
          AND NOT EXISTS (SELECT FROM motion.message y WHERE y.motion = x.motion AND y.member = cella.reader() AND y.receipt > x.message)`,
  order: 'message',
}
