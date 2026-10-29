import type { Read } from '@cella/org-db'

// The months waiting on a member's approval: each submitted and not yet
// approved, of someone else, that they may approve today as
// `circle_membership_timesheet.approves` judges it: holding approve-time over
// a circle its member sits in, or, for a worker who is no active member,
// holding it at all.
export const approvals: Read = {
  sql: `SELECT 'time/' || p.member || '/' || p.month AS id, 'approval' AS kind,
               'Approve ' || p.month || '’s time' AS what, p.member AS about,
               to_char(p.submitted, 'YYYY-MM-DD') AS since, NULL AS due, '/people/' || p.member AS href,
               p.month, p.member
        FROM timesheet.period p
        WHERE p.submitted IS NOT NULL AND p.approved IS NULL AND p.member <> cella.reader()
          AND CASE
            WHEN membership.active(p.member, cella.verdict_date()) THEN EXISTS (
              SELECT FROM circle_membership.position s
              WHERE s.member = p.member
                AND (s.since IS NULL OR s.since <= cella.verdict_date()) AND (s.until IS NULL OR s.until > cella.verdict_date())
                AND circle_membership.over(cella.reader(), 'approve-time', s.circle, cella.verdict_date())
            )
            ELSE circle_membership.may(cella.reader(), 'approve-time', NULL, cella.verdict_date())
          END`,
  order: 'month, member',
}
