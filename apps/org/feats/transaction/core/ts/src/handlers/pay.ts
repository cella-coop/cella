import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Entry, Pay, Posted } from '../models/transaction.ts'
import { committed, record } from './record.ts'

const op = 'transaction:transaction:pay' satisfies keyof typeof actions

const entry = (input: Pay): Entry => ({
  date: input.date,
  label: input.label,
  lines: [
    { account: '401', side: 'debit', cents: input.cents },
    { account: '512', side: 'credit', cents: input.cents },
  ],
})

export const paying = (input: Pay): Write<Posted> => ({
  op,
  request: input,
  state: (tx) => record(tx, entry(input)),
  payload: (posted) => committed(posted, entry(input)),
})

// Pays a supplier: 401 debited, 512 credited. Confluent, as any entry; the
// payload's `amount` is what the actor's pay-supplier mandate caps, and
// `transaction.pays` checks the entry is that payment and nothing else.
export async function pay(input: Pay, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Posted>> {
  return write(deps, paying(input))
}
