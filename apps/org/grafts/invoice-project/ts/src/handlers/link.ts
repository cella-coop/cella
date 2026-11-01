import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { Link, actions } from '../models/actions.ts'

const op = 'invoice-project:invoice:link' satisfies keyof typeof actions

// Names the project an invoice bills; naming another moves it. The
// graft's trigger refuses an invoice or a project that does not exist.
export async function link(input: Link, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Link>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(
        `INSERT INTO invoice_project.charge (invoice, project) VALUES ($1, $2)
         ON CONFLICT (invoice) DO UPDATE SET project = excluded.project`,
        [input.invoice, input.project],
      )
      return input
    },
    payload: (v) => ({ ...v }),
  })
}
