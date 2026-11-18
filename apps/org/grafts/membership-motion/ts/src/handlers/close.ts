import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { hold } from '@cella/org-circle/api'
import { closing } from '@cella/org-motion/api'
import type { Close, Closed } from '@cella/org-motion/models'

// Closes a motion, in one transaction under one verdict: the motion
// feat's close, which counts its roll. The guards of each slice judge it:
// the close's own, `motion.counted_roll` that the roll was counted among
// them. What a passing close
// carries, its admissions among them, `carried` writes in the same
// transaction, each an effect citing it. Before anything, it holds the
// circles its motion's actions lock, an
// arrangement's root, a row's circle and an amendment's (`hold`), as a write of one of them
// at once holds it before its submit takes the log's head, so the close
// and that write take the two in one order and never wait on each other
// in a circle.
export async function close(input: Close, deps: Deps): Promise<Settled<Closed> | Refused> {
  const w = closing(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const { rows } = await tx.query<{ circle: string }>(
        `SELECT DISTINCT m.args ->> 'circle' AS circle FROM motion.action m WHERE m.motion = $1 AND m.kind IN ('arrange-features', 'show-group', 'hide-feature', 'amend-circle') AND m.args ? 'circle'`,
        [input.motion],
      )
      await hold(tx, rows.map((r) => r.circle))
      return w.state(tx, proof)
    },
    payload: (v) => w.payload(v),
  })
}
