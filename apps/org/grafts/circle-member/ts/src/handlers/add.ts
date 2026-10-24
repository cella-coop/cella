import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Add, Added } from '../models/position.ts'

const op = 'circle-member:position:add' satisfies keyof typeof ops

// Seats a member in a circle from the verdict date. Ordered and decided:
// the rules on the op check that the decision it cites carried and that it
// gives this seat.
export async function add(input: Add, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Added>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; since: string }>(
        `INSERT INTO circle_member.position (circle, member, role, since)
         VALUES ($1, $2, $3, cella.verdict_date())
         RETURNING id, to_char(since, 'YYYY-MM-DD') AS since`,
        [input.circle, input.member, input.role],
      )
      return { position: Number(rows[0].id), since: rows[0].since }
    },
    payload: (v) => ({ position: v.position, circle: input.circle, member: input.member, role: input.role, decision: input.decision }),
  })
}
