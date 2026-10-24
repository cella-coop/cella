import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Admit, Admitted } from '../models/member.ts'

const op = 'member:member:admit'

// Makes an invited member active, since the verdict date, with their
// shares. The rules on this op decide: `member.admitted` that the write
// did so, the decision-member graft's that the cited decision admits, and
// circle-decision-member's that it closed and passed on its roll.
export async function admit(input: Admit, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Admitted>> {
  return write(deps, {
    op,
    state: async (tx) => {
      const { rows } = await tx.query<{ since: string }>(
        `UPDATE member.member SET status = 'active', since = cella.verdict_date(), shares = $2
         WHERE address = $1
         RETURNING to_char(since, 'YYYY-MM-DD') AS since`,
        [input.member, input.shares],
      )
      return { member: input.member, since: rows[0]?.since ?? '' }
    },
    payload: () => ({ ...input }),
  })
}
