import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { logging } from '@cella/org-timesheet/api'
import type { Log, Logged } from '@cella/org-timesheet/models'

export interface Booked extends Logged {
  project: string
}

// Time logged against a project: the timesheet feat's entry and its
// booking, in one transaction under one verdict, the log's op. The
// feat's rules and triggers judge the entry; the graft's trigger, that
// the project exists and is not archived.
export async function book(input: Log & { project: string }, deps: Deps): Promise<Settled<Booked> | Refused> {
  const { project, ...entry } = input
  const w = logging(entry)
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const logged = await w.state(tx, proof)
      await tx.query('INSERT INTO project_timesheet.booking (entry, project) VALUES ($1, $2)', [logged.entry, project])
      return { ...logged, project }
    },
    payload: (v) => ({ ...w.payload(v), project: v.project }),
  })
}
