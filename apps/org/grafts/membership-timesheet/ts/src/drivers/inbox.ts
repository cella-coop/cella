import type { Read } from '@cella/org-db'

// The months waiting on a member's approval: each submitted and not yet
// approved, of someone else, that they may approve today as the guard
// judges it: holding approve-time by a mandate covering the month's
// owning circle. A member's months of two circles are two rows, each
// for whoever may approve that circle's.
export const approvals: Read = {
  sql: `SELECT 'time/' || p.member || '/' || p.month || '/' || p.circle AS id, 'approval' AS kind,
               'Approve ' || p.month || '’s time in ' || c.name AS what, p.member AS about,
               to_char(p.submitted, 'YYYY-MM-DD') AS since, NULL AS due, '/people/' || p.member AS href,
               p.month, p.member, p.circle
        FROM timesheet.period p
        JOIN circle.circle c ON c.id = p.circle
        WHERE p.submitted IS NOT NULL AND p.approved IS NULL AND p.member <> cella.reader()
          AND circle_person.may(cella.reader(), 'approve-time', NULL, p.circle, cella.verdict_date())`,
  order: 'month, member, circle',
}
