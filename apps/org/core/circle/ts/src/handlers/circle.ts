import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Create, Created } from '../models/circle.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Creates a circle, citing the motion that creates it: beside every other
// and inside none, deciding by consent until a motion changes it. Its
// entry names the default bundle in force on the verdict date, the
// mandates on the roles every circle has, which its members and its roles
// hold there from that day with no further motion.
export async function create(input: Create, deps: Deps): Out<'circle:circle:create', Created> {
  return write(deps, {
    op: 'circle:circle:create' satisfies Action,
    request: input,
    state: async (tx) => {
      await tx.query(`INSERT INTO circle.circle (id, name, purpose) VALUES ($1, $2, $3)`, [input.id, input.name, input.purpose])
      const { rows } = await tx.query<{ bundle: string[] }>(`SELECT circle.bundle(cella.verdict_date()) AS bundle`)
      return { circle: input.id, bundle: rows[0].bundle.map(Number) }
    },
    payload: (v) => ({ circle: v.circle, name: input.name, purpose: input.purpose, bundle: v.bundle, motion: input.motion }),
  })
}
