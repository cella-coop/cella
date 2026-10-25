import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-member/models'

// The expenses waiting on a member: each submitted by someone else that
// they may approve today, holding approve-expense within its limit for
// the expense's total, and each approved that they may reimburse,
// holding reimburse-expense. Whether the approval stays within their
// month's budget is `circle_expense_member.within`'s, judged when they
// approve.
export async function expenses(db: Db, actor: string | null, today = new Date().toISOString().slice(0, 10)): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'expense/' || e.id AS id, 'approval' AS kind,
            CASE e.status WHEN 'submitted' THEN 'Approve ' ELSE 'Reimburse ' END || e.label AS what,
            coalesce(m.name, e.member) || ' · ' || e.id AS about,
            to_char(coalesce(e.decided, e.submitted), 'YYYY-MM-DD') AS since, NULL AS due, '/expenses/' || e.id AS href
     FROM expense.expense e
     LEFT JOIN member.member m ON m.address = e.member
     WHERE (e.status = 'submitted' AND e.member <> $1 AND circle_member.may($1, 'approve-expense', expense.total(e), $2::date))
        OR (e.status = 'approved' AND circle_member.may($1, 'reimburse-expense', expense.total(e), $2::date))
     ORDER BY e.id`,
    [actor, today],
  )
  return rows
}
