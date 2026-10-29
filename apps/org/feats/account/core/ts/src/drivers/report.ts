import type { Db } from '@cella/org-db'
import type { Report } from '../models/report.ts'

const columns = `r.id, r.kind, to_char(r.since, 'YYYY-MM-DD') AS since, to_char(r.until, 'YYYY-MM-DD') AS until, r.before, r.closed,
  EXISTS (SELECT FROM account.report b WHERE b.id = r.before) AS earlier`

// The spans of the books, the latest ending first, and of those ending on
// one day, the year, then the quarter, then the month.
export async function reports(db: Db): Promise<Report[]> {
  const { rows } = await db.query<Report>(
    `SELECT ${columns} FROM account.report r ORDER BY r.until DESC, array_position(ARRAY['year', 'quarter', 'month'], r.kind)`,
  )
  return rows
}

export async function report(db: Db, id: string): Promise<Report | null> {
  const { rows } = await db.query<Report>(`SELECT ${columns} FROM account.report r WHERE r.id = $1`, [id])
  return rows[0] ?? null
}
