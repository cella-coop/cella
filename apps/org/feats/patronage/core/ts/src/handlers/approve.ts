import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Approve, Approved } from '../models/distribution.ts'

const op = 'patronage:distribution:approve' satisfies keyof typeof actions

// Approves a year's split on the verdict date, citing the assembly's
// motion; in the same write the grafts that know each basis make the
// workers' parts. The guards decide: `patronage.splits` the split and the
// law's floors, `patronage.divides` the parts against the terms, each
// basis's graft its own parts, account-patronage's that the year is
// closed, patronage-transaction's the legal reserve, motion-patronage's
// that the motion approves this split, and membership-motion's
// that it passed.
export async function approve(input: Approve, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Approved>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ approved: string }>(
        `UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = $1
         RETURNING to_char(approved, 'YYYY-MM-DD') AS approved`,
        [input.distribution],
      )
      return { ...input, approved: rows[0]?.approved ?? '' }
    },
    payload: (v) => ({ ...v }),
  })
}
