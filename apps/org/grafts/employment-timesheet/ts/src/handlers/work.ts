import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { correcting, logging, submitting } from '@cella/org-timesheet/api'
import type { Correct, Corrected, Log, Logged, Period, Submitted } from '@cella/org-timesheet/models'
import type { actions } from '../models/actions.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// A worker logs their own time by their employment: the timesheet feat's
// entry, under this graft's op, which needs no mandate.
// `employment_timesheet.works` checks the actor is employed on its day, and
// the feat's guard that it is their own, on a day that has come.
export async function log(input: Log, deps: Deps): Out<'employment-timesheet:entry:log', Logged> {
  return write(deps, { ...logging(input), op: 'employment-timesheet:entry:log' satisfies Action })
}

// A worker submits their own month the same way.
export async function submit(input: Period, deps: Deps): Out<'employment-timesheet:period:submit', Submitted> {
  return write(deps, { ...submitting(input), op: 'employment-timesheet:period:submit' satisfies Action })
}

// A worker corrects their own entry the same way, while employed on its
// day.
export async function correct(input: Correct, deps: Deps): Out<'employment-timesheet:entry:correct', Corrected> {
  return write(deps, { ...correcting(input), op: 'employment-timesheet:entry:correct' satisfies Action })
}
