import type { Outcome } from '@cella/org-ops'
import { personal, write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Cast, Vote } from '../models/decision.ts'

const op = 'decision:decision:vote'

// A member's stance, received now; their stance with the highest receipt
// counts. Logged as a single-entry batch until batching arrives; on a
// secret ballot the stance is personal, so the log keeps its commitment
// and the vault the stance. A stance on a closed decision is refused by
// the feat's trigger; one for another member by `decision.own_stance`, and
// one off the roll by the circle-decision-membership graft's guard, each as
// Refused.
export async function vote(input: Vote, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Cast>> {
  let secret = false
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ receipt: string; secret: boolean }>(
        `INSERT INTO decision.vote (receipt, decision, member, stance, at)
         VALUES (cella.receipt(), $1, $2, $3, cella.verdict_date())
         RETURNING receipt, decision.secret(decision) AS secret`,
        [input.decision, input.member, input.stance],
      )
      secret = rows[0].secret
      return { receipt: Number(rows[0].receipt) }
    },
    payload: (cast) => ({
      ...input,
      stance: secret ? personal('decision.vote.stance', input.member, input.stance) : input.stance,
      receipt: cast.receipt,
    }),
  })
}
