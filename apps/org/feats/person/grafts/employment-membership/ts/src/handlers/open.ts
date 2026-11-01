import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Open, Opened } from '../models/path.ts'

const op = 'employment-membership:candidacy:open' satisfies keyof typeof actions

// Opens a worker's candidacy on the verdict date: the probation they serve
// before the assembly may admit them, and the shares they will subscribe.
// `employment_membership.opens` refuses one for a member, one outside their
// employment, or a second.
export async function open(input: Open, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Opened>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ opened: string }>(
        `INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, $2, $3, $4, cella.verdict_date())
         RETURNING to_char(opened, 'YYYY-MM-DD') AS opened`,
        [input.worker, input.from, input.to, input.shares],
      )
      return { ...input, opened: rows[0].opened }
    },
    payload: (v) => ({ ...v }),
  })
}
