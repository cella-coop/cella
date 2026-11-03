import type { Outcome } from '@cella/org-actions'
import { write, type Db, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Add, Added, Remove, Removed } from '../models/seat.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Seats a person in a circle from the verdict date: a tenure of the role
// it names, or a membership of the circle where it names none. A graft
// that seats as part of another write, as the close of a motion that
// admits, runs this inside that write's transaction.
export async function seating(tx: Db, input: Add): Promise<Added> {
  const { rows } = await tx.query<{ id: string; since: string }>(
    !input.role
      ? `INSERT INTO circle_membership.member (circle, person, since)
         VALUES ($1, $2, cella.verdict_date())
         RETURNING id, to_char(since, 'YYYY-MM-DD') AS since`
      : `INSERT INTO circle_membership.tenure (circle, holder, role, since)
         VALUES ($1, $2, $3, cella.verdict_date())
         RETURNING id, to_char(since, 'YYYY-MM-DD') AS since`,
    !input.role ? [input.circle, input.member] : [input.circle, input.member, input.role],
  )
  return { seat: Number(rows[0].id), since: rows[0].since }
}

// The seat as a write of its own, ordered and decided: the guards on the
// op check that the motion it cites carried and that it gives this
// seat.
export async function add(input: Add, deps: Deps): Out<'circle-membership:seat:add', Added> {
  return write(deps, {
    op: 'circle-membership:seat:add' satisfies Action,
    request: input,
    state: (tx) => seating(tx, input),
    payload: (v) => ({ seat: v.seat, circle: input.circle, member: input.member, role: input.role, motion: input.motion }),
  })
}

// Ends a person's tenure of a role in a circle, or their membership of it
// where it names no role, on the verdict date, citing the motion that
// ends it.
export async function remove(input: Remove, deps: Deps): Out<'circle-membership:seat:remove', Removed> {
  return write(deps, {
    op: 'circle-membership:seat:remove' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; until: string }>(
        !input.role
          ? `UPDATE circle_membership.member SET until = cella.verdict_date()
             WHERE circle = $1 AND person = $2 AND until IS NULL
             RETURNING id, to_char(until, 'YYYY-MM-DD') AS until`
          : `UPDATE circle_membership.tenure SET until = cella.verdict_date()
             WHERE circle = $1 AND holder = $2 AND role = $3 AND until IS NULL
             RETURNING id, to_char(until, 'YYYY-MM-DD') AS until`,
        !input.role ? [input.circle, input.member] : [input.circle, input.member, input.role],
      )
      return { seat: Number(rows[0]?.id ?? 0), until: rows[0]?.until ?? '' }
    },
    payload: (v) => ({ seat: v.seat, circle: input.circle, member: input.member, role: input.role, motion: input.motion }),
  })
}
