import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import { statuses, type Attend } from '../models/attendance.ts'

type Action = keyof typeof actions

// Marks a member present, excused or absent, the last mark winning, on
// the verdict date, as the actor. `mark` is a member's own, which
// `meeting_membership.marks` checks; `record` is the minutes' keeper's for
// anyone expected, which meeting-membership checks. The graft's
// trigger refuses a meeting already held and anyone not an active member.
// The payload names the meeting's circle, which the guard reads the
// keep-minutes mandate's scope against.
function marking<O extends Action>(op: O) {
  return (input: Attend, deps: Deps): Promise<Outcome<(typeof actions)[O], Attend & { circle: string }>> => {
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
        const { rows } = await tx.query<{ circle: string }>('SELECT circle FROM meeting.meeting WHERE id = $1', [input.meeting])
        return { ...input, circle: rows[0]?.circle ?? '' }
      },
      payload: (v) => ({ ...v }),
    })
  }
}

export const mark = marking('meeting-membership:attendance:mark')
export const record = marking('meeting-membership:attendance:record')
