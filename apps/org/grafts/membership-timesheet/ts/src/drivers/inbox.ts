import type { Read } from '@cella/org-db'

// The months waiting on a member's approval: each submitted and not yet
// approved, of someone else, that they may approve today as the guard
// judges it: holding approve-time by a mandate covering the month's
// owning circle.
export const approvals: Read = {
  sql: `SELECT 'time/' || p.member || '/' || p.month AS id, 'approval' AS kind,
               'Approve ' || p.month || '’s time' AS what, p.member AS about,
               to_char(p.submitted, 'YYYY-MM-DD') AS since, NULL AS due, '/people/' || p.member AS href,
               p.month, p.member
        FROM timesheet.period p
        WHERE p.submitted IS NOT NULL AND p.approved IS NULL AND p.member <> cella.reader()
          AND membership.may(cella.reader(), 'approve-time', NULL, p.circle, cella.verdict_date())`,
  order: 'month, member',
}
