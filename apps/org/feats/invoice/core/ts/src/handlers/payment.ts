import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Paid, Payment } from '../models/invoice.ts'

const op = 'invoice:invoice:payment' satisfies keyof typeof actions

// Records money received, with a receipt. A bank reference already recorded
// for the invoice merges: the payment stands once, and `merged` says so.
// Nothing is refused for paying too much; `invoice.standing` reads the
// excess as a credit owed to the client.
export const paying = (input: Payment): Write<Paid> => {
  let receipt: number | null = null
  return {
    op,
    request: input,
    state: async (tx) => {
      const fresh = await tx.query<{ id: string; receipt: string }>(
        `INSERT INTO invoice.payment (invoice, receipt, at, amount, method, reference)
         VALUES ($1, cella.receipt(), $2, cella.amount($3), $4, $5)
         ON CONFLICT (invoice, reference) DO NOTHING
         RETURNING id, receipt`,
        [input.invoice, input.at, input.amount, input.method ?? 'transfer', input.reference],
      )
      if (fresh.rows.length) {
        receipt = Number(fresh.rows[0].receipt)
        return { invoice: input.invoice, payment: Number(fresh.rows[0].id), at: input.at, merged: false }
      }
      const { rows } = await tx.query<{ id: string; at: string }>(
        `SELECT id, to_char(at, 'YYYY-MM-DD') AS at FROM invoice.payment WHERE invoice = $1 AND reference = $2`,
        [input.invoice, input.reference],
      )
      return { invoice: input.invoice, payment: Number(rows[0].id), at: rows[0].at, merged: true }
    },
    // The payment as its fold records it again, its method, the bank's
    // reference and its receipt among it.
    payload: (v) => ({
      ...v, amount: input.amount, method: input.method ?? 'transfer', reference: input.reference, ...(v.merged ? {} : { receipt }),
    }),
  }
}

// Confluent: payments add up in any order. At rung 1 a payment is refused
// only when what it posts is, as into a closed period.
export async function payment(input: Payment, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Paid>> {
  return write(deps, paying(input))
}
