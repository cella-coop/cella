import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Entry, Posted } from '../models/transaction.ts'
import { committed, record } from './record.ts'

const op = 'transaction:transaction:post' satisfies keyof typeof actions

export const posting = (input: Entry): Write<Posted> => ({
  op,
  request: input,
  state: (tx) => record(tx, input),
  payload: (posted) => committed(posted, input),
})

// Posts a balanced entry. Confluent: its balance is checked on the entry
// alone and sums of entries commute. At rung 1 it is still refused when it
// does not balance or is dated in a closed period; at rung 2 a late post is
// re-dated.
export async function post(input: Entry, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Posted>> {
  return write(deps, posting(input))
}
