import type { Db } from '@cella/org-db'
import type { Expected, OnMeeting, Quorum } from '../models/roll.ts'

// Who is expected at a meeting and who came, by name, the seated first;
// whether it is quorate; and whether the acting member keeps its minutes,
// their power reaching its circle today.
export async function onMeeting(db: Db, meeting: string, actor: string | null): Promise<OnMeeting | null> {
  const found = await db.query<{ circle: string; open: boolean }>(`SELECT circle, status = 'scheduled' AS open FROM meeting.meeting WHERE id = $1`, [meeting])
  if (!found.rows[0]) {
    return null
  }
  const { rows: roll } = await db.query<Expected>(
    `SELECT r.member AS id, r.member, coalesce(m.name, r.member) AS name, r.seated, r.status
     FROM circle_meeting_member.roll r LEFT JOIN member.member m ON m.address = r.member
     WHERE r.meeting = $1 ORDER BY r.seated DESC, name`,
    [meeting],
  )
  const { rows } = await db.query<Quorum>('SELECT seats, present, needed FROM circle_meeting_member.quorum WHERE meeting = $1', [meeting])
  const keeps = actor
    ? (await db.query<{ keeps: boolean }>(`SELECT circle_member.over($1, 'keep-minutes', $2, current_date) AS keeps`, [actor, found.rows[0].circle])).rows[0].keeps
    : false
  return { roll, quorum: rows[0] ?? { seats: 0, present: 0, needed: 0 }, open: found.rows[0].open, actor, keeps }
}

// Each meeting's quorum, for the collection's rows.
export async function quorums(db: Db): Promise<Record<string, { quorate: string }>> {
  const { rows } = await db.query<Quorum & { meeting: string }>('SELECT meeting, seats, present, needed FROM circle_meeting_member.quorum')
  return Object.fromEntries(rows.map((q) => [q.meeting, { quorate: `${q.present} of ${q.seats}` }]))
}
