import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Rebill } from '../models/rebill.ts'

const op = 'expense-project:expense:rebill' satisfies keyof typeof actions

// Files an expense under the project it was spent for, replacing any
// project it was under. `expense_project.files` checks it is the actor's
// own, still open, and the project live.
export async function rebill(input: Rebill, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Rebill>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(
        `INSERT INTO expense_project.rebill (expense, project) VALUES ($1, $2)
         ON CONFLICT (expense) DO UPDATE SET project = excluded.project`,
        [input.expense, input.project],
      )
      return { ...input }
    },
    payload: (v) => ({ ...v }),
  })
}
