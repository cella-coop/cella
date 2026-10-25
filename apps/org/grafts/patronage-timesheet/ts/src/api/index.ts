// The graft's reads and its slice, which the shell mounts: how the part of
// a surplus's work share that divides by time worked would divide among
// the members, by the minutes approved that year, until it is approved.
// Its parts are made by this graft's trigger in the write that approves.
import type { Db, Slice } from '@cella/org-db'

export interface Part {
  id: string
  member: string
  minutes: number
  amount: number
}

export async function parts(db: Db, distribution: string): Promise<Part[]> {
  const { rows } = await db.query<Part>(
    `SELECT s.member AS id, s.member, s.minutes::float8 AS minutes, s.amount::float8 AS amount
     FROM patronage_timesheet.time_share s
     JOIN patronage.distribution x ON x.id = s.distribution AND x.approved IS NULL
     WHERE s.distribution = $1
     ORDER BY s.amount DESC, s.member`,
    [distribution],
  )
  return rows
}

export const slice: Slice = {
  name: 'patronage-timesheet',
  extends: {
    distributions: { item: parts },
  },
}
