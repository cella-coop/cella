import type { Db } from '@cella/org-db'
import type { Propose } from '@cella/org-motion/models'
import type { Put } from '../models/index.ts'

// An amount in euros as a policy writes it, its thousands spaced: `3 000 €`.
const euros = (v: string | number) =>
  `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

// The legal wording of the mandate policy a grant proposes, each value
// marked once: the role, the power, what it grants in words, and its cap,
// a limit per write or a budget over a month or a year.
export function worded(args: Put['args']): string {
  const cap =
    args.limit !== undefined && args.limit !== ''
      ? `, up to {limit: ${euros(args.limit)}} a write`
      : args.budget !== undefined && args.budget !== ''
        ? `, within {budget: ${euros(args.budget)}} a {per: ${args.per ?? ''}}`
        : ''
  const grants = args.text ? `, to ${args.text}` : ''
  return `The {role: ${args.role}} role holds {power: ${args.power}}${grants}${cap}`
}

// The proposal an action about a circle makes, to the circle that decides
// it, by that circle's procedure: its parent, or for a nesting the deepest
// circle holding both its place and the one it moves to; the assembly for
// itself; for the end of a mandate's policy, the circle that adopted it,
// whose own it is. Granting a mandate proposes its policy, revoking one
// ends its policy. The title says what is decided; `circle_motion.asks`
// checks the action and that circle's say over it. circle-membership-motion
// puts it, fixing its roll in the same write.
export async function putting(input: Put, db: Db): Promise<Propose> {
  const { rows } = await db.query<{ decider: string | null; procedure: string; name: string; parent: string | null; role: string | null; mandate: string | null }>(
    `SELECT d.id AS decider, d.procedure, c.name,
            (SELECT p.name FROM circle.circle p WHERE p.id = $3) AS parent,
            (SELECT r.name FROM circle.role r WHERE r.id = $4) AS role,
            (SELECT x.power || ' from ' || r.name FROM circle.mandate x JOIN circle.role r ON r.id = x.grantee WHERE x.policy = $5) AS mandate
     FROM circle.circle c
     LEFT JOIN circle.circle d ON d.id = CASE
       WHEN $2 = 'nest' THEN (
         SELECT a FROM unnest(c.path[1:cardinality(c.path) - 1]) WITH ORDINALITY u(a, i)
         WHERE EXISTS (SELECT FROM circle.circle p WHERE p.id = $3 AND a = ANY(p.path)) ORDER BY i DESC LIMIT 1
       )
       WHEN $2 = 'revoke' THEN (SELECT r.circle FROM policy.policy r WHERE r.id = $5)
       ELSE coalesce(c.parent, c.id)
     END
     WHERE c.id = $1`,
    [input.circle, input.kind, input.args.parent ?? null, input.args.role ?? null, input.args.policy === undefined ? null : String(input.args.policy)],
  )
  const found = rows[0]
  if (!found?.decider) {
    throw new Error(`no circle may decide to ${input.kind} ${input.circle}`)
  }
  const titles = {
    nest: `Nest ${found.name} under ${found.parent ?? input.args.parent}`,
    grant: `Grant ${input.args.power} to ${found.role ?? input.args.role} in ${found.name}`,
    revoke: `Revoke ${found.mandate ?? `the mandate of ${input.args.policy}`}`,
  }
  // A nesting names the circle it moves, the one the action is about.
  const actions = {
    nest: { kind: 'nest', args: { ...input.args, circle: input.circle } },
    grant: { kind: 'policy', args: { kind: 'mandate', wording: worded(input.args) } },
    revoke: { kind: 'end', args: { policy: String(input.args.policy) } },
  }
  return {
    circle: found.decider,
    title: titles[input.kind],
    procedure: found.procedure,
    deadline: input.deadline,
    body: input.body,
    actions: [actions[input.kind]],
  }
}
