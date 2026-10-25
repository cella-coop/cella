import type { Db, Read } from '@cella/org-db'
import type { Detail, Entry, Sheet } from '../models/timesheet.ts'

const hours = '(e.minutes / 60.0)::float8'

const columns = `e.id::text AS id, e.member, to_char(e.day, 'YYYY-MM-DD') AS day, s.month, ${hours} AS hours,
  e.billable, e.note, s.state`

const from = `FROM timesheet.entry e JOIN timesheet.sheet s ON s.member = e.member AND s.month = timesheet.month_of(e.day)`

// Every entry as the collection lists it, the latest day first: its kind
// as its badge shows it, and its note or, without one, its hours.
export const entries: Read = {
  sql: `SELECT e.id::text AS id, e.member, to_char(e.day, 'YYYY-MM-DD') AS day, s.month, ${hours} AS hours,
          CASE WHEN e.billable THEN 'billable' ELSE 'internal' END AS billable,
          coalesce(nullif(e.note, ''), ${hours}::text || ' h') AS note, s.state, e.id AS n
        ${from}`,
  order: 'day DESC, member, n',
}

const sheetColumns = `member, month, hours::float8 AS hours, billable::float8 AS billable, entries,
  to_char(submitted, 'YYYY-MM-DD') AS submitted, to_char(approved, 'YYYY-MM-DD') AS approved, approver, state`

// A member's months, the latest first.
export async function sheets(db: Db, member: string): Promise<Sheet[]> {
  const { rows } = await db.query<Sheet>(`SELECT ${sheetColumns} FROM timesheet.sheet WHERE member = $1 ORDER BY month DESC`, [member])
  return rows
}

export async function sheet(db: Db, member: string, month: string): Promise<Sheet | null> {
  const { rows } = await db.query<Sheet>(`SELECT ${sheetColumns} FROM timesheet.sheet WHERE member = $1 AND month = $2`, [member, month])
  return rows[0] ?? null
}

export async function entry(db: Db, id: string): Promise<Detail | null> {
  if (!/^\d{1,18}$/.test(id)) {
    return null
  }
  const { rows } = await db.query<Entry>(`SELECT ${columns} ${from} WHERE e.id = $1`, [id])
  const e = rows[0]
  if (!e) {
    return null
  }
  const s = await sheet(db, e.member, e.month)
  return s ? { ...e, sheet: s } : null
}
