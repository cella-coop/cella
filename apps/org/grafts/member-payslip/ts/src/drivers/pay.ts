import type { Db } from '@cella/org-db'
import type { Pay } from '../models/pay.ts'

// Each payslip's member, by name, by the payslip's id.
export async function names(db: Db): Promise<Record<string, { name: string }>> {
  const { rows } = await db.query<{ id: string; name: string }>(`SELECT month || '~' || member AS id, name FROM member_payslip.slip`)
  return Object.fromEntries(rows.map((r) => [r.id, { name: r.name }]))
}

// A member's latest salary and their payslips.
export async function pay(db: Db, member: string): Promise<Pay> {
  const salary = await db.query<{ gross: string }>(
    `SELECT cella.cents(gross) AS gross FROM payslip.salary WHERE member = $1 ORDER BY "from" DESC LIMIT 1`,
    [member],
  )
  const { rows } = await db.query<Pay['payslips'][number]>(
    `SELECT p.month || '~' || p.member AS id, p.month, cella.cents(p.gross)::float8 AS gross, cella.cents(p.net)::float8 AS net,
            CASE WHEN r.paid IS NOT NULL THEN 'paid' WHEN r.approved IS NOT NULL THEN 'approved' ELSE 'prepared' END AS state
     FROM payslip.payslip p JOIN payslip.run r ON r.month = p.month
     WHERE p.member = $1 ORDER BY p.month DESC`,
    [member],
  )
  return { salary: salary.rows[0] ? Number(salary.rows[0].gross) : null, payslips: rows }
}
