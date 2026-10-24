import type { Db } from '@cella/org-db'
import type { Detail, Entry, Sheet } from '../models/timesheet.ts'

const columns = `e.id::text AS id, e.member, to_char(e.day, 'YYYY-MM-DD') AS day, s.month, (e.minutes / 60.0)::float8 AS hours,
  e.billable, e.note, s.state`

const from = `FROM timesheet.entry e JOIN timesheet.sheet s ON s.member = e.member AND s.month = timesheet.month_of(e.day)`

// Every entry, the latest day first.
export async function entries(db: Db): Promise<Entry[]> {
  const { rows } = await db.query<Entry>(`SELECT ${columns} ${from} ORDER BY e.day DESC, e.member, e.id`)
  return rows
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
