import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Close, Closed } from '../models/decision.ts'

const op = 'decision:decision:close'

// The close as a write a graft may extend in its transaction, as
// circle-decision-membership does with the admissions a passing close makes:
// closes the decision on the verdict date and fixes which stances made
// it, those received before the close's receipt. Whether it may close is
// the guard's, `decision.closes`.
export function closing(input: Close): Write<Closed> {
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ closed: string; cutoff: string }>(
        `UPDATE decision.decision SET closed = cella.verdict_date(), cutoff = cella.receipt()
         WHERE id = $1
         RETURNING to_char(closed, 'YYYY-MM-DD') AS closed, cutoff`,
        [input.decision],
      )
      const row = rows[0]
      return { decision: input.decision, closed: row?.closed ?? '', cutoff: Number(row?.cutoff ?? 0) }
    },
    payload: () => ({ ...input }),
  }
}

export async function close(input: Close, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Closed>> {
  return write(deps, closing(input))
}
