import type { Db } from '@cella/org-db'
import type { Month, Months } from '../models/sheet.ts'

// A member's months, the latest first, as `actor` sees them.
export async function months(db: Db, member: string, actor: string | null): Promise<Months> {
  const { rows } = await db.query<Month>(
    `SELECT month AS id, member, month, hours::float8 AS hours, billable::float8 AS billable, entries, state,
            to_char(submitted, 'YYYY-MM-DD') AS submitted, to_char(approved, 'YYYY-MM-DD') AS approved, approver, approver_name
     FROM member_timesheet.sheet WHERE member = $1 ORDER BY month DESC`,
    [member],
  )
  // Only an active member submits here, by their mandate; a worker who is
  // not yet one submits from their worker's page.
  const active = await db.query('SELECT FROM member.member WHERE address = $1 AND status = $2', [member, 'active'])
  return { months: rows, own: actor === member, active: Boolean(active.rowCount), acting: actor !== null }
}
