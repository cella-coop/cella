import type { Policy, Standing } from '@cella/org-policy'

// What a circle's page proposes about it: a mandate granted to a role
// by adopting its policy, a mandate revoked by ending its policy.
export type Kind = 'grant' | 'revoke'

export const kinds: { value: Kind; label: string }[] = [
  { value: 'grant', label: 'Grant a mandate to one of its roles' },
  { value: 'revoke', label: 'Revoke one of its mandates' },
]

// A circle a motion may be put in, for the New motion form.
export interface Deciding {
  id: string
  name: string
  procedure: string
}

// What a circle's page offers to propose: the circle that decides it,
// its roles and the mandates in force on them; the open motions about
// it; and the policies it adopted that are in force, each with its
// motion and its days, and every default of its legal form it left or
// never took.
export interface Proposing {
  circle: string
  // The circle that decides about this one: another holding `seat-member`,
  // or else the assembly, never by where it sits.
  decider: Deciding
  // Every circle, which a mandate's scope may name.
  circles: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  // The mandates in force on them, each by the policy that grants it.
  mandates: { policy: string; label: string }[]
  open: { motion: string; title: string; kind: string; deadline: string }[]
  policies: Policy[]
  // The defaults of its form it left, each with the motion's action that
  // left it, or never took.
  departures: Standing[]
}

// A motion about a circle, carrying one action of this graft's kinds, put
// to the circle that decides it.
export interface Put {
  circle: string
  kind: Kind
  args: Record<string, string | number>
  deadline: string
  body: string
}
