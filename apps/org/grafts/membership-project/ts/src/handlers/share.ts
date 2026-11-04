import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions, Share } from '../models/actions.ts'

const op = 'membership-project:project:share' satisfies keyof typeof actions

// Grants a member a share of a project's budget on the verdict date. The
// graft's trigger refuses one beyond what is left of the budget, or to a
// member who is not active. The payload names the project's circle, which
// the guard reads the set-budget mandate's scope against.
export async function share(input: Share, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Share & { circle: string }>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(
        'INSERT INTO membership_project.share (project, member, amount, granted) VALUES ($1, $2, cella.amount($3), cella.verdict_date())',
        [input.project, input.member, input.amount],
      )
      const { rows } = await tx.query<{ circle: string }>('SELECT circle FROM project.project WHERE id = $1', [input.project])
      return { ...input, circle: rows[0]?.circle ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
