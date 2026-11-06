import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { closing } from '@cella/org-motion/api'
import type { Close, Closed } from '@cella/org-motion/models'

// Closes a motion and counts its roll, in one transaction under one
// verdict: the motion feat's close, then who is counted, the roll's
// members active that day. The guards of each slice judge it: the close's
// own, and `counts` that the roll was counted. What a passing close
// carries, its admissions among them, `carried` writes in the same
// transaction, each an effect citing it.
export async function close(input: Close, deps: Deps): Promise<Settled<Closed> | Refused> {
  const w = closing(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const closed = await w.state(tx, proof)
      await tx.query('SELECT membership_motion.count($1)', [input.motion])
      return closed
    },
    payload: (v) => w.payload(v),
  })
}
