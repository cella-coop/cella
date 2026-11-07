import type { Db } from '@cella/org-db'
import type { Propose } from '../models/index.ts'
import { worded, type Put } from '../models/circles.ts'

export { worded } from '../models/circles.ts'

// The labels of the form's fields, which a refusal before anything is
// proposed names: the field `motion.grant_flaw` says is wrong.
const fields: Record<string, string> = {
  grantee: 'Grantee',
  power: 'Power',
  limit: 'Limit per write',
  budget: 'Budget',
  scope: 'Covers',
  procedure: 'Procedure',
  from: 'From',
  until: 'Until',
  issuer: 'Issued by',
}

// The legal wording of open books' disclosure rule a `disclose` proposes,
// Lanterne's, each value marked once with the way it is stricter, as
// core reads them (`circle.disclosure_flaw`): the fewest people a total
// may count, and the most of it one person and two may put in.
export function disclosed(args: Put['args']): string {
  for (const [name, says] of [
    ['contributors', 'the fewest people in a total'],
    ['largest', 'the most one person may put in'],
    ['two', 'the most two people may put in'],
  ]) {
    if (args[name] === undefined || args[name] === '') {
      throw new Error(`say ${says}`)
    }
  }
  return `Open books shares a total of members' own figures with every member where at least {disclosure_contributors: ${args.contributors} | more is stricter} people put into it, none of them more than {disclosure_largest: ${args.largest} % | less is stricter} of it and no two more than {disclosure_two: ${args.two} % | less is stricter}`
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

// The proposal an action about a circle makes, never by where it sits,
// since circles never nest: for a grant, the circle it names as its
// issuer, or else a circle holding `adopt-policy` and a mandate for the
// power granted that the grant is no wider than, the one it issues the
// grant under, or else the assembly (`motion.decider`); for a change or
// the end of a policy, the circle that adopted it, whose own it is and
// whose motion alone replaces it; for open books' disclosure rule, the
// assembly, whose rule it is. Granting a mandate proposes its policy,
// from and until the days it names, changing one proposes a policy
// replacing its own, and revoking one ends its policy; disclosing
// proposes the rule, replacing the one in force, and withholding ends
// that one and nothing else, put on the assembly's page where a rule
// stands. Before anything is proposed, a grant or a change is judged by
// `motion.grant_flaw` for its issuer from the day it would apply, and a
// withholding by `motion.withhold_flaw`, whose reason names the rule in
// force; a refusal names the field it is about. The title says what is
// decided; `motion.circle_asks` checks the action and that circle's say
// over it. membership-motion puts it by the procedure its requirements
// fix, fixing its roll in the same write.
export async function putting(input: Put, db: Db): Promise<Propose> {
  const { args } = input
  const mandating = input.kind === 'grant' || input.kind === 'change'
  const wording = mandating ? worded(args) : null
  const day = (v: string | number | undefined) => (v === undefined || v === '' ? null : String(v))
  const { rows } = await db.query<{ decider: string | null; name: string; grantee: string | null; mandate: string | null; standing: string | null; flaw: string | null; field: string | null }>(
    `SELECT d.decider, c.name,
            (SELECT coalesce(r.name, g.name) FROM (SELECT) x
             LEFT JOIN circle.role r ON r.id = $3 LEFT JOIN circle.circle g ON g.id = $8) AS grantee,
            (SELECT x.power || ' from ' || coalesce(r.name, g.name, x.grantee) FROM circle.mandate x
             LEFT JOIN circle.role r ON r.id = x.grantee LEFT JOIN circle.circle g ON g.id = x.grantee WHERE x.policy = $4) AS mandate,
            (SELECT s.policy FROM circle.disclosed(cella.verdict_date()) s) AS standing,
            coalesce(CASE WHEN $2 = 'withhold' THEN motion.withhold_flaw($1, $4, cella.verdict_date()) END, f.reason) AS flaw,
            f.field
     FROM circle.circle c
     CROSS JOIN LATERAL (
       SELECT CASE WHEN $2 IN ('revoke', 'change') THEN (SELECT r.circle FROM policy.policy r WHERE r.id = $4)
                   WHEN $2 IN ('disclose', 'withhold') THEN circle.assembly()
                   ELSE coalesce($9, motion.decider(c.id, ARRAY['adopt-policy', $5::jsonb ->> 'power'], cella.verdict_date(), $5::jsonb)) END AS decider
     ) d
     LEFT JOIN LATERAL motion.grant_flaw(d.decider, $6, coalesce($7::date, $10::date, cella.verdict_date()), $11::date) f ON $6 IS NOT NULL
     WHERE c.id = $1`,
    [
      input.circle,
      input.kind,
      args.role === undefined ? null : String(args.role),
      args.policy === undefined ? null : String(args.policy),
      mandating ? JSON.stringify(granting(args)) : null,
      wording,
      day(args.from),
      args.circle === undefined ? null : String(args.circle),
      day(args.issuer),
      input.deadline || null,
      day(args.until),
    ],
  )
  const found = rows[0]
  if (found?.flaw) {
    throw new Error(found.field ? `${fields[found.field] ?? found.field}: ${found.flaw}` : found.flaw)
  }
  if (!found?.decider) {
    throw new Error(`no circle may decide to ${input.kind} in ${input.circle}`)
  }
  // The days a granted or changed mandate applies from and until, where
  // the form names them.
  const from = day(args.from)
  const until = day(args.until)
  const days: Record<string, string> = { ...(from ? { from } : {}), ...(until ? { until } : {}) }
  const made: Record<Put['kind'], () => { title: string; action: Propose['actions'][number] }> = {
    grant: () => ({
      title: `Grant ${args.power} to ${found.grantee ?? args.role ?? args.circle} in ${found.name}`,
      action: { kind: 'policy', args: { kind: 'mandate', wording: wording ?? '', ...days } },
    }),
    change: () => ({
      title: `Change ${found.mandate ?? `the mandate of ${args.policy}`}`,
      action: { kind: 'policy', args: { kind: 'mandate', wording: wording ?? '', replaces: String(args.policy), ...days } },
    }),
    revoke: () => ({
      title: `Revoke ${found.mandate ?? `the mandate of ${args.policy}`}`,
      action: { kind: 'end', args: { policy: String(args.policy) } },
    }),
    disclose: () => ({
      title: `Share totals of members' own figures where at least ${args.contributors} people put in, none more than ${args.largest} % and no two more than ${args.two} %`,
      action: { kind: 'policy', args: { kind: 'rule', wording: disclosed(args), ...(found.standing ? { replaces: found.standing } : {}) } },
    }),
    withhold: () => ({
      title: "Share no total of members' own figures beyond each reader's own rights",
      action: { kind: 'end', args: { policy: String(args.policy) } },
    }),
  }
  const { title, action } = made[input.kind]()
  return { circle: found.decider, title, deadline: input.deadline, body: input.body, actions: [action] }
}
