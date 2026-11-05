import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Approved, Correct, Corrected, Log, Logged, Period, Submitted } from '../models/timesheet.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Logs an entry. The feat's trigger makes the member's period in the
// entry's circle if it is the month's first there, and refuses one into
// an approved period; `timesheet.logs` that it is the actor's own time,
// on a day that has come. A graft that files the entry under something of
// its own, as a project, runs this in its own write.
export const logging = (input: Log): Write<Logged> => ({
  op: 'timesheet:entry:log' satisfies Action,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ id: string; circle: string }>(
      `INSERT INTO timesheet.entry (member, day, minutes, billable, note, circle)
       VALUES ($1, $2, $3, $4, $5, coalesce($6, circle.assembly())) RETURNING id::text AS id, circle`,
      [input.member, input.day, input.minutes, input.billable, input.note ?? '', input.circle ?? null],
    )
    return { entry: rows[0].id, circle: rows[0].circle, member: input.member, day: input.day, minutes: input.minutes, billable: input.billable }
  },
  // The minutes and the note, the member's own words, are personal, so
  // the log keeps their commitments and the vault their values.
  payload: (v) => ({
    ...v,
    minutes: personal('timesheet.entry.minutes', v.member, v.minutes),
    note: personal('timesheet.entry.note', v.member, input.note ?? ''),
  }),
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
  op: 'timesheet:entry:correct' satisfies Action,
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

// Submits a member's month in a circle on the verdict date; submitting
// again keeps the first day. `timesheet.submits` checks it is the actor's
// own and has time of that circle in it; their month of another circle
// stays as it stands. A graft that submits it under a write of its own, as
// employment-timesheet does by the worker's employment, runs this.
export const submitting = (input: Period): Write<Submitted> => ({
  op: 'timesheet:period:submit' satisfies Action,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ submitted: string }>(
      `INSERT INTO timesheet.period (member, month, circle, submitted) VALUES ($1, $2, $3, cella.verdict_date())
       ON CONFLICT (member, month, circle) DO UPDATE SET submitted = coalesce(timesheet.period.submitted, excluded.submitted)
       RETURNING to_char(submitted, 'YYYY-MM-DD') AS submitted`,
      [input.member, input.month, input.circle],
    )
    return { ...input, submitted: rows[0].submitted }
  },
  payload: (v) => ({ ...v }),
})

export async function submit(input: Period, deps: Deps): Out<'timesheet:period:submit', Submitted> {
  return write(deps, submitting(input))
}

// Approves a member's submitted month in a circle on the verdict date,
// closing it to new entries of that circle: the update takes the period's
// row, so a log into it waits for the approval or is refused after it.
// The payload names the circle, whose scope the approve-time mandate must
// cover. `timesheet.approves` checks it was submitted, its month is over
// and the approver is not its member.
export async function approve(input: Period, deps: Deps): Out<'timesheet:period:approve', Approved> {
  return write(deps, {
    op: 'timesheet:period:approve' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ approved: string }>(
        `UPDATE timesheet.period SET approved = cella.verdict_date(), approver = $4 WHERE member = $1 AND month = $2 AND circle = $3
         RETURNING to_char(approved, 'YYYY-MM-DD') AS approved`,
        [input.member, input.month, input.circle, deps.actor],
      )
      return { ...input, approved: rows[0]?.approved ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
