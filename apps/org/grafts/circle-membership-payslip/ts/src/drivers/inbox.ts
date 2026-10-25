import type { Db } from '@cella/org-db'
import type { Ask } from '@cella/org-person/models'

// The pay runs waiting on a member: each prepared that they may approve
// today, holding approve-payroll, and each approved and unpaid that they
// may pay, holding pay-payroll; each linking to its first payslip, whose
// page approves or pays it.
export async function runs(db: Db, actor: string | null): Promise<Ask[]> {
  const { rows } = await db.query<Ask>(
    `SELECT 'run/' || r.month AS id, 'approval' AS kind,
            CASE WHEN r.approved IS NULL THEN 'Approve' ELSE 'Pay' END || ' the ' || r.month || ' pay run' AS what,
            (SELECT count(*) FROM payslip.payslip p WHERE p.month = r.month) || ' payslips' AS about,
            to_char(coalesce(r.approved, r.generated), 'YYYY-MM-DD') AS since, NULL AS due,
            coalesce('/payslips/' || r.month || '~' || (SELECT min(p.member) FROM payslip.payslip p WHERE p.month = r.month), '/payslips') AS href
     FROM payslip.run r
     WHERE (r.approved IS NULL AND circle_membership.may($1, 'approve-payroll', NULL, cella.verdict_date()))
        OR (r.approved IS NOT NULL AND r.paid IS NULL AND circle_membership.may($1, 'pay-payroll', NULL, cella.verdict_date()))
     ORDER BY r.month`,
    [actor],
  )
  return rows
}
