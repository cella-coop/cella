import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Close, Closed } from '../models/decision.ts'

const op = 'decision:decision:close'

// Closes a decision on the verdict date and fixes which stances made it:
// those received before the close's receipt. Whether it may close is the
// rule's, `decision.closes`.
export async function close(input: Close, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Closed>> {
  return write(deps, {
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
  })
}
