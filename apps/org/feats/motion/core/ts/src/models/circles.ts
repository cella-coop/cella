import type { Policy, Standing } from '@cella/org-policy'
import type { Disclosure } from './disclosure.ts'

// What a circle's page proposes about it: a mandate granted to one of its
// roles or to the circle itself by adopting its policy, a mandate changed
// by adopting one that replaces it, a mandate revoked by ending its
// policy; and, on the assembly's page, open books' disclosure values set
// by adopting its rule, or withheld by ending it.
export type Kind = 'grant' | 'change' | 'revoke' | 'disclose' | 'withhold'

export const kinds: { value: Exclude<Kind, 'disclose' | 'withhold'>; label: string }[] = [
  { value: 'grant', label: 'Grant a mandate' },
  { value: 'change', label: 'Change one of its mandates' },
  { value: 'revoke', label: 'Revoke one of its mandates' },
]

// A circle a motion may be put in, for the New motion form.
export interface Deciding {
  id: string
  name: string
  procedure: string
}

// A mandate in force on one of a circle's roles or on the circle, by the
// policy that grants it, with the values a Change starts from: its
// grantee, `role:<id>` or `circle:<id>`, its power and what it grants in
// words, its cap in euros, its scope and days, and the circle that issued
// it, whose motion alone replaces its policy.
export interface Held {
  policy: string
  label: string
  grantee: string
  power: string
  text: string
  limit: number | null
  budget: number | null
  per: string | null
  scope: string | null
  from: string
  until: string | null
  issuer: string
}

// What a circle's page offers to propose: the circle that decides it,
// those that may issue a mandate in it, its roles and the mandates in
// force on them and on it; the open motions about it; and the policies
// it adopted that are in force, each with its motion and its days, and
// every default of its legal form it left or never took.
export interface Proposing {
  circle: string
  name: string
  // The circle that decides about this one: another holding `seat-member`,
  // or else the assembly, never by where it sits.
  decider: Deciding
  // The circles whose motion may issue a mandate in it: the assembly, then
  // every other that may decide about it and holds `adopt-policy` by
  // motion; whether one holds a mandate to issue a grant under is judged
  // as the grant is proposed (`motion.grant_flaw`).
  issuers: Deciding[]
  // Every circle, which a mandate's scope may name.
  circles: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  // The mandates in force on them and on the circle, each by the policy
  // that grants it.
  mandates: Held[]
  open: { motion: string; title: string; kind: string; deadline: string }[]
  policies: Policy[]
  // The defaults of its form it left, each with the motion's action that
  // left it, or never took.
  departures: Standing[]
  // On the assembly's page, open books' disclosure rule in force; none
  // on any other circle's.
  disclosure: Disclosure | null
}

// What a mandate's page proposes about it while it stands: changing it,
// the form filled with its values, or revoking it, each by motion of the
// circle that issued it; the circle whose page lists it, and every
// circle, which its scope may name.
export interface Revising {
  circle: string
  circles: { id: string; name: string }[]
  held: Held
}

// A motion about a circle, carrying one action of these kinds, put
// to the circle that decides it.
export interface Put {
  circle: string
  kind: Kind
  args: Record<string, string | number>
  deadline: string
  body: string
}

// What a motion's actions do to the mandates, on its page: for each grant,
// the mandate it granted once closed and the parent it is issued under, or
// would be were it closed at its deadline, with what is wrong with it
// while open; for each end or replacement of a mandate's policy, that
// mandate and every one below it its close revokes. Each mandate by its
// power and grantee, with the circle whose page lists it.
export interface Issuing {
  kind: 'policy' | 'end'
  closed: boolean
  n: number
  granted: Mandate | null
  parent: Mandate | null
  flaw: string | null
  ends: Mandate | null
  revokes: Mandate[]
}

export interface Mandate {
  id: string
  power: string
  grantee: string
  issuer: string
  cap: string
  circle: string
}

// An amount in euros as a policy writes it, its thousands spaced: `3 000 €`.
const euros = (v: string | number) => `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`

const given = (v: string | number | undefined) => v !== undefined && v !== ''

// The legal wording of the mandate policy a grant or a change proposes,
// each value marked once: its grantee, a role or the circle itself, by
// motion, the power, what it grants in words, its cap, a limit per write
// or a budget over a month or a year, and its scope, the circle it covers
// or the holder's own, none for the whole co-op. The form shows it as it
// will read before anything is proposed.
export function worded(args: Put['args']): string {
  const cap = given(args.limit)
    ? `, up to {limit: ${euros(args.limit)}} a write`
    : given(args.budget)
      ? `, within {budget: ${euros(args.budget)}} a {per: ${args.per ?? ''}}`
      : ''
  const grants = args.text ? `, to ${args.text}` : ''
  const scope = !given(args.scope) ? '' : args.scope === 'own' ? ', in its {scope: own} circle' : `, in {scope: ${args.scope}}`
  const grantee = given(args.circle) ? `The {circle: ${args.circle}} circle` : `The {role: ${args.role}} role`
  const motion = given(args.circle) ? ', by motion' : ''
  return `${grantee} holds {power: ${args.power}}${grants}${motion}${cap}${scope}`
}

// A wording as it reads, its marks dropped: `The finance role holds
// send-quote, up to 5 000 € a write`.
export const reads = (wording: string) => wording.replace(/\{[a-z_]+: ([^}|]*?)\s*(\|[^}]*)?\}/g, '$1')
