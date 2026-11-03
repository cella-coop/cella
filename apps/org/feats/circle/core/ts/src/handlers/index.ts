import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Granted, Nest, Nested } from '../models/circle.ts'

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

// The mandate and the mandates revoked, as `circle.mandate_from` and
// `circle.mandate_ended` return them.
async function granted(tx: Db, sql: string, policy: string): Promise<Granted> {
  const { rows } = await tx.query<{ mandate: string | null; revoked: string[] | null }>(sql, [policy])
  const row = rows[0]
  return {
    mandate: row?.mandate === null || row?.mandate === undefined ? null : Number(row.mandate),
    revoked: (row?.revoked ?? []).map(Number),
  }
}

// Grants the mandate a mandate policy marks, in the transaction of the
// write that adopts it: its values copied into `circle.mandate`, with its
// issuer, the circle that adopted it, and the mandate it is issued under,
// none for the assembly's; and the mandate of the policy it replaces
// revoked the day it applies, with every mandate issued under it. Returns
// the mandate, or null for a policy of another kind, and those revoked.
// `circle.grants`, which circle-motion attaches to the adoption, checks
// it did.
export async function granting(tx: Db, policy: string): Promise<Granted> {
  return granted(tx, 'SELECT mandate, revoked FROM circle.mandate_from($1)', policy)
}

// Revokes the mandate of a mandate policy, in the transaction of the write
// that ends it, on the day it ends, and with it every mandate issued under
// it, down the provenance tree: a write received after it is refused, a
// share granted before it runs out on its own. Returns the mandate, or
// null, and those revoked, the mandate first. `circle.revokes` checks it
// did.
export async function revoking(tx: Db, policy: string): Promise<Granted> {
  return granted(tx, 'SELECT mandate, revoked FROM circle.mandate_ended($1)', policy)
}
