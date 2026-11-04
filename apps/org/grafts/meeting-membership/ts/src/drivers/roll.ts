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
    `SELECT r.member AS id, r.member, coalesce(mp.name, r.member) AS name, r.seated, r.status
     FROM meeting_membership.roll r LEFT JOIN (membership.member m JOIN person.person mp ON mp.address = m.address) ON m.address = r.member
     WHERE r.meeting = $1 ORDER BY r.seated DESC, name`,
    [meeting],
  )
  const { rows } = await db.query<Quorum>('SELECT seats, present, needed FROM meeting_membership.quorum WHERE meeting = $1', [meeting])
  const keeps = actor
    ? (await db.query<{ keeps: boolean }>(`SELECT membership.over($1, 'keep-minutes', $2, cella.verdict_date()) AS keeps`, [actor, found.rows[0].circle])).rows[0].keeps
    : false
  return { roll, quorum: rows[0] ?? { seats: 0, present: 0, needed: 0 }, open: found.rows[0].open, actor, keeps }
}

// Each meeting's seats present, "3 of 5", for the collection's rows.
export const quorums = `SELECT meeting AS id, present || ' of ' || seats AS quorate FROM meeting_membership.quorum`
