// The graft's reads and its slice, which the shell mounts: how the part of
// a surplus's work share that divides by time worked would divide among
// the members, by the minutes approved that year, until it is allocated.
// Its parts are made by this graft's trigger in the write that allocates.
import type { Db, Slice } from '@cella/org-db'

export interface Part {
  id: string
  member: string
  minutes: number
  amount: number
}

export async function parts(db: Db, allocation: string): Promise<Part[]> {
  const { rows } = await db.query<Part>(
    `SELECT d.worker AS id, d.worker AS member, d.minutes::float8 AS minutes, d.cents::float8 AS amount
     FROM account_timesheet.division($1) d
     JOIN account.allocation a ON a.id = $1 AND a.allocated IS NULL
     ORDER BY d.cents DESC, d.worker`,
    [allocation],
  )
  return rows
}

export const slice: Slice = {
  name: 'account-timesheet',
  extends: {
    allocations: { item: parts },
  },
}
