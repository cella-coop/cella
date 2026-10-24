import type { Outcome } from '@cella/org-ops'
import { settle, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Send, Sent } from '../models/invoice.ts'

const op = 'invoice:invoice:send' satisfies keyof typeof ops

// Marks the invoice sent on the verdict date. Sending twice keeps the first
// date; a voided invoice is not sent, and the send does nothing.
export async function send(input: Send, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Sent>> {
  return settle(deps, {
    op,
    state: async (tx) => {
      const { rows } = await tx.query<{ sent: string }>(
        `UPDATE invoice.invoice SET sent = coalesce(sent, cella.verdict_date())
         WHERE id = $1 AND voided IS NULL
         RETURNING to_char(sent, 'YYYY-MM-DD') AS sent`,
        [input.invoice],
      )
      return { invoice: input.invoice, sent: rows[0]?.sent ?? null }
    },
    payload: (v) => ({ ...v }),
  })
}
