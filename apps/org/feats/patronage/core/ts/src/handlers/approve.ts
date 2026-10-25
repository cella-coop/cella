import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Approve, Approved } from '../models/distribution.ts'

const op = 'patronage:distribution:approve' satisfies keyof typeof ops

// Approves a year's split on the verdict date, citing the assembly's
// decision; in the same write the grafts that know each basis make the
// workers' parts. The rules decide: `patronage.splits` the split and the
// law's floors, `patronage.divides` the parts against the terms, each
// basis's graft its own parts, account-patronage's that the year is
// closed, patronage-transaction's the legal reserve, decision-patronage's
// that the decision approves this split, and circle-decision-membership's
// that it passed.
export async function approve(input: Approve, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Approved>> {
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
