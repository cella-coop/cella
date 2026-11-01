import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { proposing } from '@cella/org-motion/api'
import type { Propose, Proposed } from '@cella/org-motion/models'

// Proposes a motion and fixes its roll, in the proposal's one
// transaction under one verdict: the motion feat's proposal, then the
// members seated in its circle that day. The guards of each slice judge
// it: the proposal's own, and `fixed` that the roll was fixed. Every
// proposal goes through here: the motion feat's New form, a member's
// page and a circle's.
export async function propose(input: Propose, deps: Deps): Promise<Settled<Proposed> | Refused> {
  const w = proposing(input)
  return write(deps, {
    ...w,
    state: async (tx, proof) => {
      const proposed = await w.state(tx, proof)
      await tx.query('SELECT circle_membership_motion.fix($1)', [proposed.motion])
      return proposed
    },
  })
}
