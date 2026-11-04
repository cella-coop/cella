import type { Db } from '@cella/org-db'
import type { Propose } from '../models/index.ts'
import type { Put } from '../models/circles.ts'

// An amount in euros as a policy writes it, its thousands spaced: `3 000 €`.
const euros = (v: string | number) =>
  `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

// The legal wording of the mandate policy a grant proposes, each value
// marked once: the role, the power, what it grants in words, its cap, a
// limit per write or a budget over a month or a year, and its scope, the
// circle it covers or the holder's own, none for the whole co-op.
export function worded(args: Put['args']): string {
  const cap =
    args.limit !== undefined && args.limit !== ''
      ? `, up to {limit: ${euros(args.limit)}} a write`
      : args.budget !== undefined && args.budget !== ''
        ? `, within {budget: ${euros(args.budget)}} a {per: ${args.per ?? ''}}`
        : ''
  const grants = args.text ? `, to ${args.text}` : ''
  const scope =
    args.scope === undefined || args.scope === ''
      ? ''
      : args.scope === 'own'
        ? ', in its {scope: own} circle'
        : `, in {scope: ${args.scope}}`
  return `The {role: ${args.role}} role holds {power: ${args.power}}${grants}${cap}${scope}`
}

// A grant's values as `motion.decider` reads them: its power, its
// limit and budget in cents, its period and its scope, none left blank.
function granting(args: Put['args']) {
  const given = (v: string | number | undefined) => (v === undefined || v === '' ? null : v)
  const cents = (v: string | number | undefined) => (given(v) === null ? null : Math.round(Number(v) * 100))
  return {
    power: String(args.power),
    limit: cents(args.limit),
    budget: cents(args.budget),
    per: given(args.per),
    scope: given(args.scope),
  }
}

// The proposal an action about a circle makes, to the circle that decides
// it, never by where it sits, since circles never nest: for a grant, a
// circle holding `adopt-policy` and a mandate for the power granted that
// the grant is no wider than, the one it issues the grant under, or else
// the assembly (`motion.decider`); for the end of a
// mandate's policy, the circle that adopted it, whose own it is. Granting
// a mandate proposes its policy, revoking one ends its policy. The title
// says what is decided; `motion.circle_asks` checks the action and that
// circle's say over it. membership-motion puts it by the procedure
// its requirements fix, fixing its roll in the same write.
export async function putting(input: Put, db: Db): Promise<Propose> {
  const { rows } = await db.query<{ decider: string | null; name: string; role: string | null; mandate: string | null }>(
    `SELECT CASE WHEN $2 = 'revoke' THEN (SELECT r.circle FROM policy.policy r WHERE r.id = $4)
                 ELSE motion.decider(c.id, ARRAY['adopt-policy', $5::jsonb ->> 'power'], cella.verdict_date(), $5::jsonb) END AS decider,
            c.name,
            (SELECT r.name FROM circle.role r WHERE r.id = $3) AS role,
            (SELECT x.power || ' from ' || r.name FROM circle.mandate x JOIN circle.role r ON r.id = x.grantee WHERE x.policy = $4) AS mandate
     FROM circle.circle c
     WHERE c.id = $1`,
    [
      input.circle,
      input.kind,
      input.args.role ?? null,
      input.args.policy === undefined ? null : String(input.args.policy),
      input.kind === 'grant' ? JSON.stringify(granting(input.args)) : null,
    ],
  )
  const found = rows[0]
  if (!found?.decider) {
    throw new Error(`no circle may decide to ${input.kind} in ${input.circle}`)
  }
  const titles = {
    grant: `Grant ${input.args.power} to ${found.role ?? input.args.role} in ${found.name}`,
    revoke: `Revoke ${found.mandate ?? `the mandate of ${input.args.policy}`}`,
  }
  const actions = {
    grant: { kind: 'policy', args: { kind: 'mandate', wording: worded(input.args) } },
    revoke: { kind: 'end', args: { policy: String(input.args.policy) } },
  }
  return {
    circle: found.decider,
    title: titles[input.kind],
    deadline: input.deadline,
    body: input.body,
    actions: [actions[input.kind]],
  }
}
