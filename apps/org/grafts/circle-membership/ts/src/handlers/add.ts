import type { Outcome } from '@cella/org-ops'
import { write, type Db, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Add, Added, Remove, Removed } from '../models/position.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// Seats a member in a circle from the verdict date. A graft that seats as
// part of another write, as the close of a decision that admits, runs this
// inside that write's transaction.
export async function seating(tx: Db, input: Add): Promise<Added> {
  const { rows } = await tx.query<{ id: string; since: string }>(
    `INSERT INTO circle_membership.position (circle, member, role, since)
     VALUES ($1, $2, $3, cella.verdict_date())
     RETURNING id, to_char(since, 'YYYY-MM-DD') AS since`,
    [input.circle, input.member, input.role],
  )
  return { position: Number(rows[0].id), since: rows[0].since }
}

// The seat as a write of its own, ordered and decided: the guards on the
// op check that the decision it cites carried and that it gives this
// seat.
export async function add(input: Add, deps: Deps): Out<'circle-membership:position:add', Added> {
  return write(deps, {
    op: 'circle-membership:position:add' satisfies Op,
    request: input,
    state: (tx) => seating(tx, input),
    payload: (v) => ({ position: v.position, circle: input.circle, member: input.member, role: input.role, decision: input.decision }),
  })
}

// Ends a member's seat in a circle, in a role or as a plain member, on the
// verdict date, citing the decision that ends it.
export async function remove(input: Remove, deps: Deps): Out<'circle-membership:position:remove', Removed> {
  return write(deps, {
    op: 'circle-membership:position:remove' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; until: string }>(
        `UPDATE circle_membership.position SET until = cella.verdict_date()
         WHERE circle = $1 AND member = $2 AND role IS NOT DISTINCT FROM $3 AND until IS NULL
         RETURNING id, to_char(until, 'YYYY-MM-DD') AS until`,
        [input.circle, input.member, input.role],
      )
      return { position: Number(rows[0]?.id ?? 0), until: rows[0]?.until ?? '' }
    },
    payload: (v) => ({ position: v.position, circle: input.circle, member: input.member, role: input.role, decision: input.decision }),
  })
}
