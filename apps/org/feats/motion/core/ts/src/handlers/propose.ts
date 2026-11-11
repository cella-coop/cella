import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Propose, Proposed } from '../models/motion.ts'

const op = 'motion:motion:propose' satisfies keyof typeof actions

// Proposes a motion on the verdict date with the actions it decides,
// numbered the year's next (`m-2026-013`) under a lock on the numbering,
// so two proposals at once take two numbers, as its author: the role the
// proposal names, which `motion.authored` holds its proposer to holding
// that day, or else its circle. Its proposer is the person the write is
// for. Its procedure is the one the
// write gives it, which the graft knowing its requirements fixes, or
// consent; its method is its procedure's, which a foreign key keeps, and
// its ballot the one the proposal names or else the procedure's; and its
// roll is fixed in the same write, those its procedure calls (`motion.fix`,
// which `motion.fixed` checks); `motion.proposes` checks the write made it, the
// graft registering each action's kind checks the action, and the actor
// must sit in the circle (`motion.sits`). A graft that does more in the
// same write, as membership-motion fixes the procedure, runs this state
// inside its own. The title and the text are the proposer's words: the log commits
// to them and the vault keeps them.
export function proposing(input: Propose): Write<Proposed> {
  const procedure = input.procedure ?? 'consent'
  let proposer = ''
  return {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext('motion.motion'))`)
      const { rows } = await tx.query<Proposed & { proposer: string }>(
        `INSERT INTO motion.motion (id, circle, author, proposer, title, method, procedure, ballot, proposed, deadline, body)
         SELECT 'm-' || y || '-' || lpad(x.next::text, greatest(3, length(x.next::text)), '0'),
                $1, $7, cella.reader(), $2, p.method, p.id, coalesce($6, p.ballot), cella.verdict_date(), $4, $5
         FROM (SELECT to_char(cella.verdict_date(), 'YYYY') AS y) v
         JOIN motion.procedure p ON p.id = $3
         CROSS JOIN LATERAL (
           SELECT coalesce(max(split_part(d.id, '-', 3)::int), 0) + 1 AS next
           FROM motion.motion d WHERE d.id LIKE 'm-' || v.y || '-%'
         ) x
         RETURNING id AS motion, to_char(proposed, 'YYYY-MM-DD') AS proposed, ballot, author, proposer`,
        [input.circle, input.title, procedure, input.deadline, input.body, input.ballot ?? null, input.author ?? null],
      )
      if (!rows[0]) {
        throw new Error(`a motion is taken by a procedure of the co-op’s, not “${procedure}”`)
      }
      const { proposer: by, ...proposed } = rows[0]
      proposer = by
      for (const [i, m] of input.actions.entries()) {
        await tx.query('INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, $3, $4)', [proposed.motion, i + 1, m.kind, m.args])
      }
      await tx.query('SELECT motion.fix($1)', [proposed.motion])
      return proposed
    },
    payload: (v) => ({
      motion: v.motion,
      circle: input.circle,
      author: v.author,
      procedure,
      ballot: v.ballot,
      deadline: input.deadline,
      title: personal('motion.motion.title', proposer, input.title),
      body: personal('motion.motion.body', proposer, input.body),
      actions: input.actions,
    }),
  }
}

export async function propose(input: Propose, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Proposed>> {
  return write(deps, proposing(input))
}
