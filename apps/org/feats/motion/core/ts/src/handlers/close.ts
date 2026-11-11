import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Close, Closed } from '../models/motion.ts'

const op = 'motion:motion:close'

// The close as a write a graft may extend in its transaction, as
// membership-motion does with the admissions a passing close makes:
// closes the motion on the verdict date and fixes which stances made
// it, those received before the close's receipt, and counts its roll, the
// people of it whose seat counts that day (`motion.count`, which
// `motion.counted_roll` checks). Whether it may close is the guard's,
// `motion.closes`.
export function closing(input: Close): Write<Closed> {
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ closed: string; cutoff: string }>(
        `UPDATE motion.motion SET closed = cella.verdict_date(), cutoff = cella.receipt()
         WHERE id = $1
         RETURNING to_char(closed, 'YYYY-MM-DD') AS closed, cutoff`,
        [input.motion],
      )
      await tx.query('SELECT motion.count($1)', [input.motion])
      const row = rows[0]
      return { motion: input.motion, closed: row?.closed ?? '', cutoff: Number(row?.cutoff ?? 0) }
    },
    payload: (v) => ({ ...input, closed: v.closed, cutoff: v.cutoff }),
  }
}

export async function close(input: Close, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Closed>> {
  return write(deps, closing(input))
}
