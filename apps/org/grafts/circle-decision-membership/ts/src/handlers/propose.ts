import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { proposing } from '@cella/org-decision/api'
import type { Propose, Proposed } from '@cella/org-decision/models'

// Proposes a decision and fixes its roll, in the proposal's one
// transaction under one verdict: the decision feat's proposal, then the
// members seated in its circle that day. The rules of each slice judge
// it: the proposal's own, and `fixed` that the roll was fixed. Every
// proposal goes through here: the decision feat's New form, a member's
// page and a circle's.
export async function propose(input: Propose, deps: Deps): Promise<Settled<Proposed> | Refused> {
  const w = proposing(input)
  return write(deps, {
    ...w,
    state: async (tx, proof) => {
      const proposed = await w.state(tx, proof)
      await tx.query('SELECT circle_decision_membership.fix($1)', [proposed.decision])
      return proposed
    },
  })
}
