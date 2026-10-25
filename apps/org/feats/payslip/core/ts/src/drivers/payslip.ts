import type { Db, Read } from '@cella/org-db'
import type { Payslip } from '../models/payslip.ts'

const columns = `p.month || '~' || p.member AS id, p.month, p.member, (p.minutes / 60.0)::float8 AS hours,
  cella.cents(p.gross)::float8 AS gross, cella.cents(p.employee)::float8 AS employee, cella.cents(p.employer)::float8 AS employer,
  cella.cents(p.net)::float8 AS net, (cella.cents(p.gross) + cella.cents(p.employer))::float8 AS cost,
  CASE WHEN r.paid IS NOT NULL THEN 'paid' WHEN r.approved IS NOT NULL THEN 'approved' ELSE 'prepared' END AS state,
  to_char(r.generated, 'YYYY-MM-DD') AS generated, to_char(r.approved, 'YYYY-MM-DD') AS approved, r.approver,
  to_char(r.paid, 'YYYY-MM-DD') AS paid`

const from = 'FROM payslip.payslip p JOIN payslip.run r ON r.month = p.month'

// The payslips as the collection lists them, the latest month first, each
// with its title.
export const listing: Read = {
  sql: `SELECT ${columns}, 'Payslip ' || p.month AS label ${from}`,
  order: 'month DESC, member',
}

// Every payslip, the latest month first.
export async function payslips(db: Db): Promise<Payslip[]> {
  const { rows } = await db.query<Payslip>(`SELECT ${columns} ${from} ORDER BY p.month DESC, p.member`)
  return rows
}

// A payslip by its id, `<month>~<member>`.
export async function payslip(db: Db, id: string): Promise<Payslip | null> {
  const [month, member] = id.split('~')
  const { rows } = await db.query<Payslip>(`SELECT ${columns} ${from} WHERE p.month = $1 AND p.member = $2`, [month, member ?? ''])
  return rows[0] ?? null
}

// The month a new run is for unless finance says otherwise: the first
// month with no run.
export async function next(db: Db): Promise<{ month: string }> {
  const { rows } = await db.query<{ month: string }>(
    `SELECT to_char(coalesce(max(payslip.after(month)), date_trunc('month', cella.verdict_date())::date), 'YYYY-MM') AS month FROM payslip.run`,
  )
  return { month: rows[0].month }
}
