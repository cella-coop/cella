import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { adopting, ending } from './adopt.ts'
import type { Adopt, Adopted, End, Ended } from '../models/index.ts'
import { granting, revoking } from '@cella/org-graft-circle-policy/api'
import type { Granted } from '@cella/org-graft-circle-policy/models'

const none: Granted = { mandate: null, revoked: [] }

// Adopts the policy a passed motion carries, and for a mandate policy
// grants its mandate, in the adoption's one transaction under one
// verdict: the motion feat's adoption, then core's copy of its
// values into `circle.mandate`. The guards of each slice judge it:
// `motion.adopts` that it is the policy the motion carries,
// `circle_policy.grants` that its mandate is as its values say, issued by its
// circle under the parent it holds, and that the mandate of the policy it
// replaces is revoked with every mandate issued under it, `circle.narrows`
// that it is narrower than that parent, or a root the assembly issued. A
// refused mandate refuses the adoption. It submits the mandate and each
// mandate it revoked.
export async function adopt(input: Adopt, deps: Deps): Promise<Settled<Adopted & Granted> | Refused> {
  const w = adopting(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const adopted = await w.state(tx, proof)
      return { ...adopted, ...(adopted.policy ? await granting(tx, adopted.policy) : none) }
    },
    payload: (v) => ({ ...w.payload(v), mandate: v.mandate, revoked: v.revoked }),
  })
}

// Ends the policy a passed motion names, and for a mandate policy revokes
// its mandate on the day it ends, with every mandate issued under it down
// the provenance tree, in one transaction: `motion.ends`, `circle_policy.revokes`
// and `circle.narrows` judge it, the latter two refusing an end that
// leaves a mandate issued under it standing. It submits the mandate and
// each mandate it revoked.
export async function end(input: End, deps: Deps): Promise<Settled<Ended & Granted> | Refused> {
  const w = ending(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const ended = await w.state(tx, proof)
      return { ...ended, ...(ended.policy ? await revoking(tx, ended.policy) : none) }
    },
    payload: (v) => ({ ...w.payload(v), mandate: v.mandate, revoked: v.revoked }),
  })
}
