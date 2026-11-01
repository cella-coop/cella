import type { Db } from '@cella/org-db'
import { summaries } from '@cella/org-motion/api'
import type { OnMeeting, Sitting, Tabled } from '../models/tabled.ts'

// A meeting's items that table motions, numbered as its agenda reads,
// and where each motion stands.
export async function onMeeting(db: Db, meeting: string): Promise<OnMeeting> {
  const { rows } = await db.query<Tabled>(
    `SELECT i.id::text AS id, a.n, i.title, t.motion, d.title AS name, d.circle,
            to_char(d.deadline, 'YYYY-MM-DD') AS deadline, to_char(d.closed, 'YYYY-MM-DD') AS closed
     FROM meeting_motion.tabled t
     JOIN meeting.item i ON i.id = t.item
     JOIN (SELECT id, (row_number() OVER (ORDER BY pos, id))::int AS n FROM meeting.item WHERE meeting = $1) a ON a.id = i.id
     JOIN motion.motion d ON d.id = t.motion
     WHERE t.meeting = $1 ORDER BY a.n`,
    [meeting],
  )
  const open = await db.query<{ open: boolean }>(`SELECT status = 'scheduled' AS open FROM meeting.meeting WHERE id = $1`, [meeting])
  return { tabled: rows, motions: await summaries(db), open: open.rows[0]?.open ?? false }
}

// The meetings a motion is tabled at, the latest first.
export async function sittings(db: Db, motion: string): Promise<Sitting[]> {
  const { rows } = await db.query<Sitting>(
    `SELECT DISTINCT m.id AS meeting, m.title, to_char(m.at, 'YYYY-MM-DD"T"HH24:MI') AS at, m.status
     FROM meeting_motion.tabled t JOIN meeting.meeting m ON m.id = t.meeting
     JOIN meeting.item i ON i.id = t.item
     WHERE t.motion = $1 ORDER BY at DESC`,
    [motion],
  )
  return rows
}
