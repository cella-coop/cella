import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-person/models'

// The expenses waiting on a member: each submitted by someone else that
// they may approve today, holding approve-expense within its limit for
// the expense's total, and each approved that they may reimburse,
// holding reimburse-expense. Whether the approval stays within their
// month's budget is `circle_expense_membership.within`'s, judged when they
// approve.
export async function expenses(db: Db, actor: string | null): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'expense/' || e.id AS id, 'approval' AS kind,
            CASE e.status WHEN 'submitted' THEN 'Approve ' ELSE 'Reimburse ' END || e.label AS what,
            coalesce(mp.name, e.member) || ' · ' || e.id AS about,
            to_char(coalesce(e.decided, e.submitted), 'YYYY-MM-DD') AS since, NULL AS due, '/expenses/' || e.id AS href
     FROM expense.expense e
     LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = e.member
     WHERE (e.status = 'submitted' AND e.member <> $1 AND circle_membership.may($1, 'approve-expense', expense.total(e), cella.verdict_date()))
        OR (e.status = 'approved' AND circle_membership.may($1, 'reimburse-expense', expense.total(e), cella.verdict_date()))
     ORDER BY e.id`,
    [actor],
  )
  return rows
}
