import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Close, Closed } from '../models/period.ts'

const op = 'account:period:close' satisfies keyof typeof actions

// Closes a period on the verdict date. The update takes the period's row,
// so a post into it waits for the close or is refused after it; whether it
// may close is `account.closes`'s.
export async function close(input: Close, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Closed>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ closed: string }>(
        `UPDATE account.period SET closed = cella.verdict_date() WHERE month = $1
         RETURNING to_char(closed, 'YYYY-MM-DD') AS closed`,
        [input.month],
      )
      return { month: input.month, closed: rows[0]?.closed ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
