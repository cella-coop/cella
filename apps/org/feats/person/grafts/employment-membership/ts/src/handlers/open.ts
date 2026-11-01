import type { Outcome } from '@cella/org-actions'
import { done, write, type Deps, type Done } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Open, Opened } from '../models/path.ts'

const op = 'employment-membership:candidacy:open' satisfies keyof typeof actions

// Opens the worker's own candidacy on the verdict date, the day they
// applied: their probation from their hire to the day before, and the
// shares they will subscribe. `employment_membership.opens` refuses one
// for someone else, for a member, or for one who has not applied that
// day; one for someone not yet working is refused before the
// notary, and a second by the candidacy's key.
export async function open(input: Open, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Opened>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<Opened>(
        `INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened)
         SELECT w.address, w.start, cella.verdict_date() - 1, $2, cella.verdict_date() FROM employment.worker w
         WHERE w.address = $1 AND w.start < cella.verdict_date()
         RETURNING worker, to_char("from", 'YYYY-MM-DD') AS "from", to_char("to", 'YYYY-MM-DD') AS "to", shares, to_char(opened, 'YYYY-MM-DD') AS opened`,
        [input.worker, input.shares],
      )
      if (!rows[0]) {
        throw new Error(`${input.worker} is no worker yet: a candidacy runs from a hire`)
      }
      return rows[0]
    },
    payload: (v) => ({ ...v }),
  })
}

// What follows an application: the applicant's candidacy, opened by
// `open` as their own write, signed by them by the same right, pledging
// the shares their application did.
export async function opened(request: unknown, deps: Deps): Promise<Done[]> {
  const { member, shares } = request as { member: string; shares: number }
  const input = { worker: member, shares }
  return [done('employment-membership:candidacy:open', await open(input, deps), [], input)]
}
