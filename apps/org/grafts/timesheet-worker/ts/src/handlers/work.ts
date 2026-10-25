import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { logging, submitting } from '@cella/org-timesheet/api'
import type { Log, Logged, Period, Submitted } from '@cella/org-timesheet/models'
import type { ops } from '../models/ops.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// A worker logs their own time by their employment: the timesheet feat's
// entry, under this graft's op, which needs no mandate.
// `timesheet_worker.works` checks the actor is employed on its day, and
// the feat's rule that it is their own, on a day that has come.
export async function log(input: Log, deps: Deps): Out<'timesheet-worker:entry:log', Logged> {
  return write(deps, { ...logging(input), op: 'timesheet-worker:entry:log' satisfies Op })
}

// A worker submits their own month the same way.
export async function submit(input: Period, deps: Deps): Out<'timesheet-worker:period:submit', Submitted> {
  return write(deps, { ...submitting(input), op: 'timesheet-worker:period:submit' satisfies Op })
}
