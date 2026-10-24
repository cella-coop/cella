import type { Db } from '@cella/org-db'
import type { OnMeeting, Sitting, Summary, Tabled } from '../models/tabled.ts'

// Every decision of the scope, the latest first, as an embed draws it and
// the agenda offers it; a picker that searches replaces the list when
// they are many.
export async function summaries(db: Db): Promise<Summary[]> {
  const { rows } = await db.query<Summary>(
    `SELECT id, title, circle, rule, to_char(deadline, 'YYYY-MM-DD') AS deadline, to_char(closed, 'YYYY-MM-DD') AS closed
     FROM decision.decision ORDER BY proposed DESC, id DESC`,
  )
  return rows
}

// A meeting's items that table decisions, numbered as its agenda reads,
// and where each decision stands.
export async function onMeeting(db: Db, meeting: string): Promise<OnMeeting> {
  const { rows } = await db.query<Tabled>(
    `SELECT i.id::text AS id, a.n, i.title, t.decision, d.title AS name, d.circle,
            to_char(d.deadline, 'YYYY-MM-DD') AS deadline, to_char(d.closed, 'YYYY-MM-DD') AS closed
     FROM decision_meeting.tabled t
     JOIN meeting.item i ON i.id = t.item
     JOIN (SELECT id, (row_number() OVER (ORDER BY pos, id))::int AS n FROM meeting.item WHERE meeting = $1) a ON a.id = i.id
     JOIN decision.decision d ON d.id = t.decision
     WHERE t.meeting = $1 ORDER BY a.n`,
    [meeting],
  )
  const open = await db.query<{ open: boolean }>(`SELECT status = 'scheduled' AS open FROM meeting.meeting WHERE id = $1`, [meeting])
  return { tabled: rows, decisions: await summaries(db), open: open.rows[0]?.open ?? false }
}

// The meetings a decision is tabled at, the latest first.
export async function sittings(db: Db, decision: string): Promise<Sitting[]> {
  const { rows } = await db.query<Sitting>(
    `SELECT DISTINCT m.id AS meeting, m.title, to_char(m.at, 'YYYY-MM-DD"T"HH24:MI') AS at, m.status
     FROM decision_meeting.tabled t JOIN meeting.meeting m ON m.id = t.meeting
     JOIN meeting.item i ON i.id = t.item
     WHERE t.decision = $1 ORDER BY at DESC`,
    [decision],
  )
  return rows
}
