import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Duties, Make, Remade, Remake } from '../models/circle.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Makes a role in a circle, or a `*` role every working circle has,
// citing the motion that makes it: its id, name, duty and cap, holding
// nothing until a motion grants it a mandate. Its entry carries all four.
export async function make(input: Make, deps: Deps): Out<'circle:role:make', { role: string }> {
  return write(deps, {
    op: 'circle:role:make' satisfies Action,
    request: input,
    state: async (tx) => {
      await tx.query(`INSERT INTO circle.role (id, circle, name, duty, holders) VALUES ($1, $2, $3, $4, $5)`, [
        input.id,
        input.circle,
        input.name,
        input.duty,
        input.holders,
      ])
      return { role: input.id }
    },
    payload: (v) => ({ role: v.role, circle: input.circle, name: input.name, duty: input.duty, holders: input.holders, motion: input.motion }),
  })
}

const duties = ['name', 'duty', 'holders'] as const

// Amends a role, citing the motion that changes it: its name, its duty or
// its cap from the verdict date; its id, its circle, its tenures and its
// mandates stay. Its entry carries each term it changed and what it was.
export async function remake(input: Remake, deps: Deps): Out<'circle:role:amend', Remade> {
  const given: Duties = Object.fromEntries(duties.filter((t) => input[t] !== undefined && input[t] !== null).map((t) => [t, input[t]]))
  return write(deps, {
    op: 'circle:role:amend' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<Required<Duties>>(`SELECT name, duty, holders FROM circle.role WHERE id = $1 FOR UPDATE`, [input.role])
      const was: Duties = Object.fromEntries(Object.keys(given).map((t) => [t, rows[0]?.[t as keyof Duties] ?? null]))
      await tx.query(`UPDATE circle.role SET name = coalesce($2, name), duty = coalesce($3, duty), holders = coalesce($4, holders) WHERE id = $1`, [
        input.role,
        given.name ?? null,
        given.duty ?? null,
        given.holders ?? null,
      ])
      return { role: input.role, was }
    },
    payload: (v) => ({ role: v.role, ...given, was: v.was, motion: input.motion }),
  })
}
