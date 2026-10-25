import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Grant, Granted, Nest, Nested, Revoke, Revoked } from '../models/circle.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// Each write is decided: it cites the decision that asks it, which the
// circle-decision graft checks asks this, and circle-decision-membership that
// it carried. This feat's rules check the write did what its payload says.

// Nests a circle under another. The tree's trigger refuses a cycle in the
// write's own view; `circle.nests` refuses one that a nesting settled
// first made, which the trigger could not see.
export async function nest(input: Nest, deps: Deps): Out<'circle:circle:nest', Nested> {
  return write(deps, {
    op: 'circle:circle:nest' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ path: string[] }>('UPDATE circle.circle SET parent = $2 WHERE id = $1 RETURNING path', [
        input.circle,
        input.parent,
      ])
      return { circle: input.circle, parent: input.parent, path: rows[0]?.path ?? [] }
    },
    payload: (v) => ({ circle: v.circle, parent: v.parent, decision: input.decision }),
  })
}

// Grants a power to a role from the verdict date.
export async function grant(input: Grant, deps: Deps): Out<'circle:mandate:grant', Granted> {
  return write(deps, {
    op: 'circle:mandate:grant' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; from: string }>(
        `INSERT INTO circle.mandate (role, power, text, "limit", budget, per, "from", until)
         VALUES ($1, $2, $3, cella.amount($4), cella.amount($5), $6, cella.verdict_date(), $7)
         RETURNING id, to_char("from", 'YYYY-MM-DD') AS from`,
        [input.role, input.power, input.text, input.limit ?? null, input.budget ?? null, input.per ?? null, input.until ?? null],
      )
      return { mandate: Number(rows[0].id), role: input.role, power: input.power, from: rows[0].from }
    },
    payload: (v) => ({ ...v, limit: input.limit ?? null, budget: input.budget ?? null, per: input.per ?? null, decision: input.decision }),
  })
}

// Revokes a mandate on the verdict date: a write received after it is
// refused, a share granted before it runs out on its own.
export async function revoke(input: Revoke, deps: Deps): Out<'circle:mandate:revoke', Revoked> {
  return write(deps, {
    op: 'circle:mandate:revoke' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ revoked: string }>(
        `UPDATE circle.mandate SET revoked = cella.verdict_date() WHERE id = $1 AND revoked IS NULL
         RETURNING to_char(revoked, 'YYYY-MM-DD') AS revoked`,
        [input.mandate],
      )
      return { mandate: input.mandate, revoked: rows[0]?.revoked ?? '' }
    },
    payload: (v) => ({ mandate: v.mandate, decision: input.decision }),
  })
}
