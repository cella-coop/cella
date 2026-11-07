import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Approve, Approved } from '../models/distribution.ts'

const op = 'patronage:distribution:approve' satisfies keyof typeof actions

// Approves a year's split on the verdict date, citing the assembly's
// motion; in the same write it makes the workers' parts, as the division
// each basis's graft registers answers them (`patronage.divide`). The
// guards decide: `patronage.splits` the split and the
// law's floors, `patronage.divides` the parts against the terms, each
// basis's graft its own parts, account-patronage's that the year is
// closed, patronage-transaction's the legal reserve, motion-patronage's
// that the motion approves this split, and membership-motion's
// that it passed.
export async function approve(input: Approve, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Approved>> {
  // The parts it made, which its payload keeps for its fold.
  let parts: { worker: string; basis: string; quantity: string | null; cents: string | null }[] = []
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ approved: string }>(
        `UPDATE patronage.distribution SET approved = cella.verdict_date() WHERE id = $1
         RETURNING to_char(approved, 'YYYY-MM-DD') AS approved`,
        [input.distribution],
      )
      await tx.query('SELECT patronage.divide($1)', [input.distribution])
      parts = (
        await tx.query<{ worker: string; basis: string; quantity: string | null; cents: string | null }>(
          'SELECT worker, basis, quantity, cella.cents(amount) AS cents FROM patronage.part WHERE distribution = $1 ORDER BY worker, basis',
          [input.distribution],
        )
      ).rows
      return { ...input, approved: rows[0]?.approved ?? '' }
    },
    // Each part's quantity and amount are its worker's: the log keeps
    // their commitments.
    payload: (v) => ({
      ...v,
      parts: parts.map((p) => ({
        worker: p.worker,
        basis: p.basis,
        quantity: p.quantity === null ? null : personal('patronage.part.quantity', p.worker, Number(p.quantity)),
        amount: p.cents === null ? null : personal('patronage.part.amount', p.worker, Number(p.cents)),
      })),
    }),
  })
}
