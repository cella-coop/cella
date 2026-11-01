import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Adjust, Posted } from '../models/transaction.ts'
import { committed, record } from './record.ts'

const op = 'transaction:transaction:adjust' satisfies keyof typeof actions

export const adjusting = (input: Adjust): Write<Posted> => ({
  op,
  request: input,
  state: (tx) => record(tx, input.entry, input.corrects),
  payload: (posted) => ({ ...committed(posted, input.entry), corrects: input.corrects, base: input.base }),
})

// Posts a correcting entry, ordered on its base: `transaction.corrects`
// refuses it if the corrected entry was corrected since the base it read.
export async function adjust(input: Adjust, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Posted>> {
  return write(deps, adjusting(input))
}
