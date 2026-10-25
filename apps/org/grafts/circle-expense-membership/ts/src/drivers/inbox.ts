import type { Read } from '@cella/org-db'

// The expenses waiting on a member: each submitted by someone else that
// they may approve today, holding approve-expense within its limit for
// the expense's total, and each approved that they may reimburse,
// holding reimburse-expense. Whether the approval stays within their
// month's budget is `circle_expense_membership.within`'s, judged when they
// approve.
export const expenses: Read = {
  sql: `SELECT 'expense/' || e.id AS id, 'approval' AS kind,
               CASE e.status WHEN 'submitted' THEN 'Approve ' ELSE 'Reimburse ' END || e.label AS what,
               coalesce(mp.name, e.member) || ' · ' || e.id AS about,
               to_char(coalesce(e.decided, e.submitted), 'YYYY-MM-DD') AS since, NULL AS due, '/expenses/' || e.id AS href,
               e.id AS expense
        FROM expense.expense e
        LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = e.member
        WHERE (e.status = 'submitted' AND e.member <> cella.reader() AND circle_membership.may(cella.reader(), 'approve-expense', expense.total(e), cella.verdict_date()))
           OR (e.status = 'approved' AND circle_membership.may(cella.reader(), 'reimburse-expense', expense.total(e), cella.verdict_date()))`,
  order: 'expense',
}
