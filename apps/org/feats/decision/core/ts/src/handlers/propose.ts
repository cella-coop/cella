import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Propose, Proposed } from '../models/decision.ts'

const op = 'decision:decision:propose' satisfies keyof typeof ops

// Proposes a decision on the verdict date with the motions it decides,
// numbered the year's next (`d-2026-013`) under a lock on the numbering,
// so two proposals at once take two numbers. Its roll is fixed as it is
// inserted, by circle-decision-membership; its rule is its procedure's, which
// a foreign key keeps, and its ballot the one the proposal names or else
// the procedure's; `decision.proposes` checks the
// write made it, the graft registering each motion's kind checks the
// motion, and the actor must sit in the circle. The title and the text
// are the proposer's words and stay out of the log.
export async function propose(input: Propose, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Proposed>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext('decision.decision'))`)
      const { rows } = await tx.query<Proposed>(
        `INSERT INTO decision.decision (id, circle, title, rule, procedure, ballot, proposed, deadline, body)
         SELECT 'd-' || y || '-' || lpad((coalesce(max(split_part(d.id, '-', 3)::int), 0) + 1)::text, 3, '0'),
                $1, $2, p.rule, p.id, coalesce($6, p.ballot), cella.verdict_date(), $4, $5
         FROM (SELECT to_char(cella.verdict_date(), 'YYYY') AS y) v
         JOIN decision.procedure p ON p.id = $3
         LEFT JOIN decision.decision d ON d.id LIKE 'd-' || v.y || '-%'
         GROUP BY v.y, p.id, p.rule, p.ballot
         RETURNING id AS decision, to_char(proposed, 'YYYY-MM-DD') AS proposed, ballot`,
        [input.circle, input.title, input.procedure, input.deadline, input.body, input.ballot ?? null],
      )
      if (!rows[0]) {
        throw new Error(`a decision is taken by a procedure of the co-op’s, not “${input.procedure}”`)
      }
      const { decision } = rows[0]
      for (const [i, m] of input.motions.entries()) {
        await tx.query('INSERT INTO decision.motion (decision, n, kind, args) VALUES ($1, $2, $3, $4)', [decision, i + 1, m.kind, m.args])
      }
      return rows[0]
    },
    payload: (v) => ({ decision: v.decision, circle: input.circle, procedure: input.procedure, ballot: v.ballot, deadline: input.deadline, motions: input.motions }),
  })
}
