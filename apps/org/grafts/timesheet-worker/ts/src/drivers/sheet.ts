import type { Db } from '@cella/org-db'
import type { Month, Months } from '../models/sheet.ts'

// Whose each entry is, by entry: the worker's name, which the dashboard
// groups hours by.
export async function whose(db: Db): Promise<Record<string, { who: string }>> {
  const { rows } = await db.query<{ id: string; name: string }>(
    'SELECT e.id::text AS id, w.name FROM timesheet.entry e JOIN worker.worker w ON w.address = e.member',
  )
  return Object.fromEntries(rows.map((r) => [r.id, { who: r.name }]))
}

// A worker's months, the latest first, as `actor` sees them.
export async function months(db: Db, worker: string, actor: string | null): Promise<Months> {
  const { rows } = await db.query<Month>(
    `SELECT month AS id, member, month, hours::float8 AS hours, billable::float8 AS billable, entries, state,
            to_char(submitted, 'YYYY-MM-DD') AS submitted, to_char(approved, 'YYYY-MM-DD') AS approved, approver, approver_name
     FROM timesheet_worker.sheet WHERE member = $1 ORDER BY month DESC`,
    [worker],
  )
  return { months: rows, own: actor === worker, acting: actor !== null }
}
