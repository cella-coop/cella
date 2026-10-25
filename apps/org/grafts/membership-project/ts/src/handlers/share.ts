import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops, Share } from '../models/ops.ts'

const op = 'membership-project:project:share' satisfies keyof typeof ops

// Grants a member a share of a project's budget on the verdict date. The
// graft's trigger refuses one beyond what is left of the budget, or to a
// member who is not active.
export async function share(input: Share, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Share>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(
        'INSERT INTO membership_project.share (project, member, amount, granted) VALUES ($1, $2, cella.amount($3), cella.verdict_date())',
        [input.project, input.member, input.amount],
      )
      return input
    },
    payload: (v) => ({ ...v }),
  })
}
