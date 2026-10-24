import type { Db } from '@cella/org-db'
import type { Held, Met, OnCircle, Setting } from '../models/meeting.ts'

const defaults: Setting = { quorum: 50, adopts: false }

// How a circle meets, its defaults where it set nothing.
export async function setting(db: Db, circle: string): Promise<Setting> {
  const { rows } = await db.query<Setting>('SELECT quorum, adopts FROM circle_meeting.setting WHERE circle = $1', [circle])
  return rows[0] ?? defaults
}

// A meeting's circle, by name, and how it meets.
export async function heldBy(db: Db, meeting: string): Promise<Held | null> {
  const { rows } = await db.query<{ circle: string; name: string }>(
    `SELECT c.id AS circle, c.name FROM meeting.meeting m JOIN circle.circle c ON c.id = m.circle WHERE m.id = $1`,
    [meeting],
  )
  return rows[0] ? { ...rows[0], ...(await setting(db, rows[0].circle)) } : null
}

// A circle's meetings, the latest first, and the next one scheduled.
export async function onCircle(db: Db, circle: string): Promise<OnCircle> {
  const { rows } = await db.query<Met>(
    `SELECT id, title, to_char(at, 'YYYY-MM-DD"T"HH24:MI') AS at, status FROM meeting.meeting WHERE circle = $1 ORDER BY at DESC`,
    [circle],
  )
  const next = rows.filter((m) => m.status === 'scheduled').at(-1) ?? null
  return { meetings: rows, next, ...(await setting(db, circle)) }
}
