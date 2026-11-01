import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import { logging } from '@cella/org-timesheet/api'
import type { Log, Logged } from '@cella/org-timesheet/models'

export interface Booked extends Logged {
  project: string
}

// An entry a write logs, booked to a project in the same transaction
// under one verdict, the write's op: the timesheet feat's log here, a
// worker's by their employment in a graft above. The feat's guards and
// triggers judge the entry; the graft's trigger, that the project exists
// and is not archived.
export const booking = (w: Write<Logged>, project: string): Write<Booked> => ({
  op: w.op,
  request: { ...(w.request as object), project },
  state: async (tx, proof) => {
    const logged = await w.state(tx, proof)
    await tx.query('INSERT INTO project_timesheet.booking (entry, project) VALUES ($1, $2)', [logged.entry, project])
    return { ...logged, project }
  },
  payload: (v) => ({ ...w.payload(v), project: v.project }),
})

// Time logged against a project, by the log-time mandate.
export async function book(input: Log & { project: string }, deps: Deps): Promise<Settled<Booked> | Refused> {
  const { project, ...entry } = input
  return write(deps, booking(logging(entry), project))
}
