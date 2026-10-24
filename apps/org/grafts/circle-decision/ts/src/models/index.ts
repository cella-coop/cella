import type { Rule } from '@cella/org-decision/models'

// The kinds of motion this graft carries: a circle nested, a power
// granted to a role, a mandate revoked.
export type Kind = 'nest' | 'grant' | 'revoke'

export const kinds: { value: Kind; label: string }[] = [
  { value: 'nest', label: 'Nest it under another circle' },
  { value: 'grant', label: 'Grant a mandate to one of its roles' },
  { value: 'revoke', label: 'Revoke one of its mandates' },
]

// A circle a decision may be put in, for the New decision form.
export interface Deciding {
  id: string
  name: string
  procedure: Rule
}

// What a circle's page offers to propose: where each kind of decision
// goes, the circles it may be nested under, its roles and the mandates in
// force on them; and the open decisions about it.
export interface Proposing {
  circle: string
  // The circle that decides about this one: its parent, or the assembly
  // for the assembly itself.
  decider: Deciding
  under: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  mandates: { id: string; label: string }[]
  open: { decision: string; title: string; kind: Kind; deadline: string }[]
}

// A motion about a circle, put to the circle that decides it.
export interface Motion {
  circle: string
  kind: Kind
  args: Record<string, string | number>
  deadline: string
  body: string
}
