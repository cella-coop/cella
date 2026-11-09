import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { closing } from '@cella/org-motion/api'
import type { Close, Closed } from '@cella/org-motion/models'

// Closes a motion, in one transaction under one verdict: the motion
// feat's close, which counts its roll. The guards of each slice judge it:
// the close's own, `motion.counted_roll` that the roll was counted among
// them. What a passing close
// carries, its admissions among them, `carried` writes in the same
// transaction, each an effect citing it.
export async function close(input: Close, deps: Deps): Promise<Settled<Closed> | Refused> {
  const w = closing(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: (tx, proof) => w.state(tx, proof),
    payload: (v) => w.payload(v),
  })
}
