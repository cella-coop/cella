import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Adopt, Adopted } from '../models/terms.ts'

const op = 'patronage:terms:adopt' satisfies keyof typeof actions

// Adopts drafted terms on the verdict date, citing the members' motion.
// The guards decide: `patronage.adopts` that they divide the whole work
// share and govern no year already approved, motion-patronage's that
// the motion moved to adopt them, and circle-membership-motion's that it
// passed. Adopted terms never change.
export async function adopt(input: Adopt, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Adopted>> {
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
