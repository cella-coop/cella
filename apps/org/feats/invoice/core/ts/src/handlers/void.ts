import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Void, Voided } from '../models/invoice.ts'

const op = 'invoice:invoice:void' satisfies keyof typeof ops

// Voids the invoice on the verdict date. Ordered against its payments:
// `invoice.voids` refuses it once any payment was received.
export const voiding = (input: Void): Write<Voided> => ({
  op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ voided: string }>(
      `UPDATE invoice.invoice SET voided = cella.verdict_date(), reason = $2
       WHERE id = $1
       RETURNING to_char(voided, 'YYYY-MM-DD') AS voided`,
      [input.invoice, input.reason],
    )
    return { invoice: input.invoice, voided: rows[0]?.voided ?? '' }
  },
  // The reason is free text and stays out of the log.
  payload: (v) => ({ ...v }),
})

// `void` is a keyword, so the handler is `annul`; the write is still void.
export async function annul(input: Void, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Voided>> {
  return write(deps, voiding(input))
}
