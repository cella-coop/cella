import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Nest, Nested } from '../models/circle.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Nests a circle under another, citing the motion that asks it, which the
// circle-motion graft checks asks this, and circle-membership-motion that
// it carried. The tree's trigger refuses a cycle in the write's own view;
// `circle.nests` refuses one that a nesting settled first made, which the
// trigger could not see.
export async function nest(input: Nest, deps: Deps): Out<'circle:circle:nest', Nested> {
  return write(deps, {
    op: 'circle:circle:nest' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ path: string[] }>('UPDATE circle.circle SET parent = $2 WHERE id = $1 RETURNING path', [
        input.circle,
        input.parent,
      ])
      return { circle: input.circle, parent: input.parent, path: rows[0]?.path ?? [] }
    },
    payload: (v) => ({ circle: v.circle, parent: v.parent, motion: input.motion }),
  })
}

// Grants the mandate a mandate policy marks, in the transaction of the
// write that adopts it: its values copied into `circle.mandate`, and the
// mandate of the policy it replaces revoked the day it applies. Returns
// the mandate, or null for a policy of another kind. `circle.grants`, which
// circle-motion attaches to the adoption, checks it did.
export async function granting(tx: Db, policy: string): Promise<number | null> {
  const { rows } = await tx.query<{ mandate: string | null }>('SELECT circle.mandate_from($1) AS mandate', [policy])
  return rows[0]?.mandate === null || rows[0]?.mandate === undefined ? null : Number(rows[0].mandate)
}

// Revokes the mandate of a mandate policy, in the transaction of the write
// that ends it, on the day it ends: a write received after it is refused,
// a share granted before it runs out on its own. Returns the mandate, or
// null. `circle.revokes` checks it did.
export async function revoking(tx: Db, policy: string): Promise<number | null> {
  const { rows } = await tx.query<{ mandate: string | null }>('SELECT circle.mandate_ended($1) AS mandate', [policy])
  return rows[0]?.mandate === null || rows[0]?.mandate === undefined ? null : Number(rows[0].mandate)
}
