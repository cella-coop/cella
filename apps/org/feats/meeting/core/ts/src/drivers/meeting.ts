import type { Db, Read } from '@cella/org-db'
import type { Detail, Item, Meeting, Offered } from '../models/meeting.ts'

const columns = `m.id, m.circle, m.title, to_char(m.at, 'YYYY-MM-DD"T"HH24:MI') AS at, m.place, m.link, m.status,
  to_char(m.settled, 'YYYY-MM-DD') AS settled, to_char(m.minuted, 'YYYY-MM-DD') AS minuted,
  (SELECT count(*)::int FROM meeting.item i WHERE i.meeting = m.id) AS items,
  (SELECT coalesce(sum(i.minutes), 0)::int FROM meeting.item i WHERE i.meeting = m.id) AS length`

// The meetings as the collection lists them, the latest first: the place
// "online" where there is only a link, and no length while the agenda has
// none.
export const listing: Read = {
  sql: `SELECT id, circle, title, at, coalesce(nullif(place, ''), CASE WHEN link <> '' THEN 'online' END) AS place, link, status,
          settled, minuted, items, nullif(length, 0) AS length
        FROM (SELECT ${columns} FROM meeting.meeting m) m`,
  order: 'at DESC, id',
}

// Every meeting, the latest first.
export async function meetings(db: Db): Promise<Meeting[]> {
  const { rows } = await db.query<Meeting>(`SELECT ${columns} FROM meeting.meeting m ORDER BY m.at DESC, m.id`)
  return rows
}

// The items of a meeting's agenda, in order, numbered from one.
export async function agenda(db: Db, meeting: string): Promise<Item[]> {
  const { rows } = await db.query<Item>(
    `SELECT id::text AS id, (row_number() OVER (ORDER BY pos, id))::int AS n, title, presenter, minutes
     FROM meeting.item WHERE meeting = $1 ORDER BY pos, id`,
    [meeting],
  )
  return rows
}

export async function item(db: Db, id: string): Promise<Detail | null> {
  const { rows } = await db.query<Meeting & { scheduled: string | null }>(
    `SELECT ${columns}, to_char(m.scheduled, 'YYYY-MM-DD') AS scheduled FROM meeting.meeting m WHERE m.id = $1`,
    [id],
  )
  return rows[0] ? { ...rows[0], agenda: await agenda(db, id) } : null
}

export async function offered(db: Db): Promise<Offered> {
  const { rows } = await db.query<{ circle: string }>('SELECT DISTINCT circle FROM meeting.meeting ORDER BY circle')
  return { circles: rows.map((r) => r.circle) }
}
