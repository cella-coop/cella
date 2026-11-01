import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Adopt, Adopted } from '../models/terms.ts'

const op = 'patronage:terms:adopt' satisfies keyof typeof ops

// Adopts drafted terms on the verdict date, citing the members' decision.
// The guards decide: `patronage.adopts` that they divide the whole work
// share and govern no year already approved, decision-patronage's that
// the decision moved to adopt them, and circle-decision-membership's that it
// passed. Adopted terms never change.
export async function adopt(input: Adopt, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Adopted>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ adopted: string }>(
        `UPDATE patronage.terms SET adopted = cella.verdict_date() WHERE id = $1
         RETURNING to_char(adopted, 'YYYY-MM-DD') AS adopted`,
        [input.terms],
      )
      return { ...input, adopted: rows[0]?.adopted ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
