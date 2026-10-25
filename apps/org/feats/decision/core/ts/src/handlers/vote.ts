import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Cast, Vote } from '../models/decision.ts'

const op = 'decision:decision:vote'

// A member's stance, received now; their stance with the highest receipt
// counts. Logged as a single-entry batch until batching arrives. A stance on
// a closed decision is refused by the feat's trigger; one for another member
// by `decision.own_stance`, and one off the roll by the
// circle-decision-membership graft's rule, each as Refused.
export async function vote(input: Vote, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Cast>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ receipt: string }>(
        `INSERT INTO decision.vote (receipt, decision, member, stance, at)
         VALUES (cella.receipt(), $1, $2, $3, cella.verdict_date())
         RETURNING receipt`,
        [input.decision, input.member, input.stance],
      )
      return { receipt: Number(rows[0].receipt) }
    },
    payload: (cast) => ({ ...input, receipt: cast.receipt }),
  })
}
