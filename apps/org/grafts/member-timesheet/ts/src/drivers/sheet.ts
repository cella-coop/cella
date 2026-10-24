import type { Db } from '@cella/org-db'
import type { Month, Months } from '../models/sheet.ts'

// Whose each entry is, by entry: the member's name, which the dashboard
// groups hours by.
export async function whose(db: Db): Promise<Record<string, { who: string }>> {
  const { rows } = await db.query<{ id: string; name: string }>(
    'SELECT e.id::text AS id, m.name FROM timesheet.entry e JOIN member.member m ON m.address = e.member',
  )
  return Object.fromEntries(rows.map((r) => [r.id, { who: r.name }]))
}

// A member's months, the latest first, as `actor` sees them.
export async function months(db: Db, member: string, actor: string | null): Promise<Months> {
  const { rows } = await db.query<Month>(
    `SELECT month AS id, member, month, hours::float8 AS hours, billable::float8 AS billable, entries, state,
            to_char(submitted, 'YYYY-MM-DD') AS submitted, to_char(approved, 'YYYY-MM-DD') AS approved, approver, approver_name
     FROM member_timesheet.sheet WHERE member = $1 ORDER BY month DESC`,
    [member],
  )
  return { months: rows, own: actor === member, acting: actor !== null }
}
