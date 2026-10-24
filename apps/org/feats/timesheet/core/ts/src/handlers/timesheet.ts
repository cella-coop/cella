import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Approved, Log, Logged, Period, Submitted } from '../models/timesheet.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// Logs an entry. The feat's trigger makes the member's period if it is
// the month's first and refuses one into an approved period;
// `timesheet.logs` that it is the actor's own time, on a day that has
// come. A graft that files the entry under something of its own, as a
// project, runs this in its own write.
export const logging = (input: Log): Write<Logged> => ({
  op: 'timesheet:entry:log' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      'INSERT INTO timesheet.entry (member, day, minutes, billable, note) VALUES ($1, $2, $3, $4, $5) RETURNING id::text AS id',
      [input.member, input.day, input.minutes, input.billable, input.note ?? ''],
    )
    return { entry: rows[0].id, member: input.member, day: input.day, minutes: input.minutes, billable: input.billable }
  },
  // The note is the member's own words and stays out.
  payload: (v) => ({ ...v }),
})

export async function log(input: Log, deps: Deps): Out<'timesheet:entry:log', Logged> {
  return write(deps, logging(input))
}

// Submits a member's month on the verdict date; submitting again keeps
// the first day. `timesheet.submits` checks it is the actor's own and has
// time in it.
export async function submit(input: Period, deps: Deps): Out<'timesheet:period:submit', Submitted> {
  return write(deps, {
    op: 'timesheet:period:submit' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ submitted: string }>(
        `INSERT INTO timesheet.period (member, month, submitted) VALUES ($1, $2, cella.verdict_date())
         ON CONFLICT (member, month) DO UPDATE SET submitted = coalesce(timesheet.period.submitted, excluded.submitted)
         RETURNING to_char(submitted, 'YYYY-MM-DD') AS submitted`,
        [input.member, input.month],
      )
      return { ...input, submitted: rows[0].submitted }
    },
    payload: (v) => ({ ...v }),
  })
}

// Approves a submitted month on the verdict date, closing it to new
// entries: the update takes the period's row, so a log into it waits for
// the approval or is refused after it. `timesheet.approves` checks it
// was submitted, its month is over and the approver is not its member.
export async function approve(input: Period, deps: Deps): Out<'timesheet:period:approve', Approved> {
  return write(deps, {
    op: 'timesheet:period:approve' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ approved: string }>(
        `UPDATE timesheet.period SET approved = cella.verdict_date(), approver = $3 WHERE member = $1 AND month = $2
         RETURNING to_char(approved, 'YYYY-MM-DD') AS approved`,
        [input.member, input.month, deps.actor],
      )
      return { ...input, approved: rows[0]?.approved ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
