import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import { statuses, type Attend } from '../models/attendance.ts'

type Op = keyof typeof ops

// Marks a member present, excused or absent, the last mark winning, on
// the verdict date, as the actor. `mark` is a member's own, which
// `meeting_membership.marks` checks; `record` is the minutes' keeper's for
// anyone expected, which circle-meeting-membership checks. The graft's
// trigger refuses a meeting already held and anyone not an active member.
function marking<O extends Op>(op: O) {
  return (input: Attend, deps: Deps): Promise<Outcome<(typeof ops)[O], Attend>> => {
    if (!statuses.includes(input.status)) {
      throw new Error(`“${input.status}” is none of ${statuses.join(', ')}`)
    }
    return write(deps, {
      op,
      request: input,
      state: async (tx) => {
        await tx.query(
          `INSERT INTO meeting_membership.attendance (meeting, member, status, marked, by)
           VALUES ($1, $2, $3, cella.verdict_date(), $4)
           ON CONFLICT (meeting, member) DO UPDATE SET status = excluded.status, marked = excluded.marked, by = excluded.by`,
          [input.meeting, input.member, input.status, deps.actor],
        )
        return input
      },
      payload: (v) => ({ ...v }),
    })
  }
}

export const mark = marking('meeting-membership:attendance:mark')
export const record = marking('meeting-membership:attendance:record')
