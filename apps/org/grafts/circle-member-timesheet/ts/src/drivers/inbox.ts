import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-member/models'

// The months waiting on a member's approval: each submitted and not yet
// approved, of someone else, that they may approve today as
// `circle_member_timesheet.approves` judges it: holding approve-time over
// a circle its member sits in, or, for a worker who is no active member,
// holding it at all.
export async function approvals(db: Db, actor: string | null): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'time/' || p.member || '/' || p.month AS id, 'approval' AS kind,
            'Approve ' || p.month || '’s time' AS what, p.member AS about,
            to_char(p.submitted, 'YYYY-MM-DD') AS since, NULL AS due, '/workers/' || p.member AS href
     FROM timesheet.period p
     WHERE p.submitted IS NOT NULL AND p.approved IS NULL AND p.member <> $1
       AND CASE
         WHEN EXISTS (SELECT FROM member.member m WHERE m.address = p.member AND m.status = 'active') THEN EXISTS (
           SELECT FROM circle_member.position s
           WHERE s.member = p.member
             AND (s.since IS NULL OR s.since <= cella.verdict_date()) AND (s.until IS NULL OR s.until > cella.verdict_date())
             AND circle_member.over($1, 'approve-time', s.circle, cella.verdict_date())
         )
         ELSE circle_member.may($1, 'approve-time', NULL, cella.verdict_date())
       END
     ORDER BY p.month, p.member`,
    [actor],
  )
  return rows
}
