import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Rebill } from '../models/rebill.ts'

const op = 'expense-project:expense:rebill' satisfies keyof typeof ops

// Files an expense under the project it was spent for, replacing any
// project it was under. `expense_project.files` checks it is the actor's
// own, still open, and the project live.
export async function rebill(input: Rebill, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Rebill>> {
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
