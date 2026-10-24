import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Adjust, Posted } from '../models/transaction.ts'
import { committed, record } from './record.ts'

const op = 'transaction:transaction:adjust' satisfies keyof typeof ops

export const adjusting = (input: Adjust): Write<Posted> => ({
  op,
  state: (tx) => record(tx, input.entry, input.corrects),
  payload: (posted) => ({ ...committed(posted, input.entry), corrects: input.corrects, base: input.base }),
})

// Posts a correcting entry, ordered on its base: `transaction.corrects`
// refuses it if the corrected entry was corrected since the base it read.
export async function adjust(input: Adjust, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Posted>> {
  return write(deps, adjusting(input))
}
