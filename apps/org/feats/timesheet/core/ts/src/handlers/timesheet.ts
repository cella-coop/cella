import type { Outcome } from '@cella/org-ops'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Approved, Correct, Corrected, Log, Logged, Period, Submitted } from '../models/timesheet.ts'

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
  // The note is the member's own words and stays out; the minutes are
  // personal, so the log keeps their commitment and the vault the minutes.
  payload: (v) => ({ ...v, minutes: personal('timesheet.entry.minutes', v.member, v.minutes) }),
})

export async function log(input: Log, deps: Deps): Out<'timesheet:entry:log', Logged> {
  return write(deps, logging(input))
}

// Corrects an entry by lowering its time to the minutes given, to none
// where none was worked; a correction to more than it holds leaves it as
// it is. The feat's trigger refuses one into an approved period and any
// change but a lower time; `timesheet.corrects` that it is the actor's
// own entry. A graft that corrects it under a write of its own, as
// employment-timesheet does by the worker's employment, runs this.
export const correcting = (input: Correct): Write<Corrected> => ({
  op: 'timesheet:entry:correct' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ member: string; day: string }>(
      `UPDATE timesheet.entry SET minutes = least(minutes, $2) WHERE id::text = $1
       RETURNING member, to_char(day, 'YYYY-MM-DD') AS day`,
      [input.entry, input.minutes],
    )
    return { ...input, member: rows[0]?.member ?? null, day: rows[0]?.day ?? null }
  },
  // The minutes an entry is brought to are its member's, as logged; a
  // correction of no entry names no one's.
  payload: (v) => ({ ...v, minutes: v.member ? personal('timesheet.entry.minutes', v.member, v.minutes) : v.minutes }),
})

export async function correct(input: Correct, deps: Deps): Out<'timesheet:entry:correct', Corrected> {
  return write(deps, correcting(input))
}

// Submits a member's month on the verdict date; submitting again keeps
// the first day. `timesheet.submits` checks it is the actor's own and has
// time in it. A graft that submits it under a write of its own, as
// employment-timesheet does by the worker's employment, runs this.
export const submitting = (input: Period): Write<Submitted> => ({
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

export async function submit(input: Period, deps: Deps): Out<'timesheet:period:submit', Submitted> {
  return write(deps, submitting(input))
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
