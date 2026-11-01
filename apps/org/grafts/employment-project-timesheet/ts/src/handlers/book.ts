import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { logging } from '@cella/org-timesheet/api'
import type { Log } from '@cella/org-timesheet/models'
import { booking, type Booked } from '@cella/org-graft-project-timesheet/api'
import type { actions } from '../models/actions.ts'

const op = 'employment-project-timesheet:entry:book' satisfies keyof typeof actions

// A worker books their own time to a project by their employment: the
// timesheet feat's entry and project-timesheet's booking, under this
// graft's op, which needs no mandate. `timesheet.logs` and
// `employment_timesheet.works` judge the entry, project-timesheet's trigger
// the project.
export async function book(input: Log & { project: string }, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Booked>> {
  const { project, ...entry } = input
  return write(deps, { ...booking(logging(entry), project), op })
}
