import type { Db } from '@cella/org-db'
import type { Propose } from '@cella/org-decision/models'
import type { Motion } from '../models/index.ts'

// The proposal a motion about a circle makes, to the circle that decides
// it, by that circle's procedure: its parent, or for a nesting the deepest
// circle holding both its place and the one it moves to; the assembly for
// itself. The title says what is decided; `circle_decision.asks` checks
// the motion and that circle's say over it. circle-decision-membership
// puts it, fixing its roll in the same write.
export async function putting(input: Motion, db: Db): Promise<Propose> {
  const { rows } = await db.query<{ decider: string | null; procedure: string; name: string; parent: string | null; role: string | null; mandate: string | null }>(
    `SELECT d.id AS decider, d.procedure, c.name,
            (SELECT p.name FROM circle.circle p WHERE p.id = $3) AS parent,
            (SELECT r.name FROM circle.role r WHERE r.id = $4) AS role,
            (SELECT x.power || ' from ' || r.name FROM circle.mandate x JOIN circle.role r ON r.id = x.role WHERE x.id::text = $5) AS mandate
     FROM circle.circle c
     LEFT JOIN circle.circle d ON d.id = CASE
       WHEN $2 = 'nest' THEN (
         SELECT a FROM unnest(c.path[1:cardinality(c.path) - 1]) WITH ORDINALITY u(a, i)
         WHERE EXISTS (SELECT FROM circle.circle p WHERE p.id = $3 AND a = ANY(p.path)) ORDER BY i DESC LIMIT 1
       )
       ELSE coalesce(c.parent, c.id)
     END
     WHERE c.id = $1`,
    [input.circle, input.kind, input.args.parent ?? null, input.args.role ?? null, input.args.mandate === undefined ? null : String(input.args.mandate)],
  )
  const found = rows[0]
  // A nesting names the circle it moves, the one the motion is about.
  const args = input.kind === 'nest' ? { ...input.args, circle: input.circle } : input.args
  if (!found?.decider) {
    throw new Error(`no circle may decide to ${input.kind} ${input.circle}`)
  }
  const titles = {
    nest: `Nest ${found.name} under ${found.parent ?? input.args.parent}`,
    grant: `Grant ${input.args.power} to ${found.role ?? input.args.role} in ${found.name}`,
    revoke: `Revoke ${found.mandate ?? `mandate ${input.args.mandate}`}`,
  }
  return {
    circle: found.decider,
    title: titles[input.kind],
    procedure: found.procedure,
    deadline: input.deadline,
    body: input.body,
    motions: [{ kind: input.kind, args }],
  }
}
