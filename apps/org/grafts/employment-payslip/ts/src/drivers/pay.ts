import type { Db } from '@cella/org-db'
import type { Pay } from '../models/pay.ts'

// Each payslip's worker, by name, by the payslip's id.
export const names = `SELECT month || '~' || member AS id, name, job FROM employment_payslip.slip`

// A worker's latest salary and their payslips.
export async function pay(db: Db, worker: string): Promise<Pay> {
  const salary = await db.query<{ gross: string }>(
    `SELECT cella.cents(gross) AS gross FROM payslip.salary WHERE member = $1 ORDER BY "from" DESC LIMIT 1`,
    [worker],
  )
  const { rows } = await db.query<Pay['payslips'][number]>(
    `SELECT p.month || '~' || p.member AS id, p.month, cella.cents(p.gross)::float8 AS gross, cella.cents(p.net)::float8 AS net,
            CASE WHEN r.paid IS NOT NULL THEN 'paid' WHEN r.approved IS NOT NULL THEN 'approved' ELSE 'prepared' END AS state
     FROM payslip.payslip p JOIN payslip.run r ON r.month = p.month
     WHERE p.member = $1 ORDER BY p.month DESC`,
    [worker],
  )
  return { salary: salary.rows[0] ? Number(salary.rows[0].gross) : null, payslips: rows }
}

// Each worker's salary in force, by their address.
export const salaries = `SELECT s.id, s.salary FROM (
  SELECT DISTINCT ON (member) member AS id, until, cella.cents(gross) AS salary FROM payslip.salary
  WHERE "from" <= cella.verdict_date() ORDER BY member, "from" DESC
) s WHERE s.until IS NULL OR s.until >= cella.verdict_date()`
