import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Propose, Proposed } from '../models/motion.ts'

const op = 'motion:motion:propose' satisfies keyof typeof actions

// Proposes a motion on the verdict date with the actions it decides,
// numbered the year's next (`m-2026-013`) under a lock on the numbering,
// so two proposals at once take two numbers. Its method is its procedure's,
// which a foreign key keeps, and its ballot the one the proposal names or
// else the procedure's; `motion.proposes` checks the write made it, the
// graft registering each action's kind checks the action, and the actor
// must sit in the circle. A graft that fixes more in the same write, as
// circle-membership-motion fixes the roll, runs this state inside its
// own. The title and the text are the proposer's words and stay out of
// the log.
export function proposing(input: Propose): Write<Proposed> {
  return {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext('motion.motion'))`)
      const { rows } = await tx.query<Proposed>(
        `INSERT INTO motion.motion (id, circle, title, method, procedure, ballot, proposed, deadline, body)
         SELECT 'm-' || y || '-' || lpad((coalesce(max(split_part(d.id, '-', 3)::int), 0) + 1)::text, 3, '0'),
                $1, $2, p.method, p.id, coalesce($6, p.ballot), cella.verdict_date(), $4, $5
         FROM (SELECT to_char(cella.verdict_date(), 'YYYY') AS y) v
         JOIN motion.procedure p ON p.id = $3
         LEFT JOIN motion.motion d ON d.id LIKE 'm-' || v.y || '-%'
         GROUP BY v.y, p.id, p.method, p.ballot
         RETURNING id AS motion, to_char(proposed, 'YYYY-MM-DD') AS proposed, ballot`,
        [input.circle, input.title, input.procedure, input.deadline, input.body, input.ballot ?? null],
      )
      if (!rows[0]) {
        throw new Error(`a motion is taken by a procedure of the co-op’s, not “${input.procedure}”`)
      }
      const { motion } = rows[0]
      for (const [i, m] of input.actions.entries()) {
        await tx.query('INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, $3, $4)', [motion, i + 1, m.kind, m.args])
      }
      return rows[0]
    },
    payload: (v) => ({ motion: v.motion, circle: input.circle, procedure: input.procedure, ballot: v.ballot, deadline: input.deadline, actions: input.actions }),
  }
}

export async function propose(input: Propose, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Proposed>> {
  return write(deps, proposing(input))
}
