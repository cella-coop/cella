import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { Link, actions } from '../models/actions.ts'

const op = 'client-invoice:billing:link' satisfies keyof typeof actions

// Links an invoice to the client it bills; linking again moves it. The
// graft's trigger refuses an invoice or a client that does not exist.
export async function link(input: Link, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Link>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(
        `INSERT INTO client_invoice.billing (invoice, client) VALUES ($1, $2)
         ON CONFLICT (invoice) DO UPDATE SET client = excluded.client`,
        [input.invoice, input.client],
      )
      return input
    },
    payload: (v) => ({ ...v }),
  })
}
