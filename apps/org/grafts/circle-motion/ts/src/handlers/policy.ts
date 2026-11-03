import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { adopting, ending } from '@cella/org-motion/api'
import type { Adopt, Adopted, End, Ended } from '@cella/org-motion/models'
import { granting, revoking } from '@cella/org-circle/api'

// Adopts the policy a passed motion carries, and for a mandate policy
// grants its mandate, in the adoption's one transaction under one
// verdict: the motion feat's adoption, then the circle feat's copy of its
// values into `circle.mandate`. The guards of each slice judge it:
// `motion.adopts` that it is the policy the motion carries,
// `circle.grants` that its mandate is as its values say, issued by its
// circle under the parent it holds, `circle.narrows` that it is narrower
// than that parent, or a root the assembly issued. A refused mandate
// refuses the adoption.
export async function adopt(input: Adopt, deps: Deps): Promise<Settled<Adopted & { mandate: number | null }> | Refused> {
  const w = adopting(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const adopted = await w.state(tx, proof)
      return { ...adopted, mandate: adopted.policy ? await granting(tx, adopted.policy) : null }
    },
    payload: (v) => ({ ...w.payload(v), mandate: v.mandate }),
  })
}

// Ends the policy a passed motion names, and for a mandate policy revokes
// its mandate on the day it ends, in one transaction: `motion.ends`,
// `circle.revokes` and `circle.narrows` judge it, the latter refusing an
// end that leaves a mandate issued under it standing.
export async function end(input: End, deps: Deps): Promise<Settled<Ended & { mandate: number | null }> | Refused> {
  const w = ending(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const ended = await w.state(tx, proof)
      return { ...ended, mandate: ended.policy ? await revoking(tx, ended.policy) : null }
    },
    payload: (v) => ({ ...w.payload(v), mandate: v.mandate }),
  })
}
