// The kinds of action this graft carries: a circle nested, a power
// granted to a role, a mandate revoked.
export type Kind = 'nest' | 'grant' | 'revoke'

export const kinds: { value: Kind; label: string }[] = [
  { value: 'nest', label: 'Nest it under another circle' },
  { value: 'grant', label: 'Grant a mandate to one of its roles' },
  { value: 'revoke', label: 'Revoke one of its mandates' },
]

// A circle a motion may be put in, for the New motion form.
export interface Deciding {
  id: string
  name: string
  procedure: string
}

// What a circle's page offers to propose: where each kind of motion
// goes, the circles it may be nested under, its roles and the mandates in
// force on them; and the open motions about it.
export interface Proposing {
  circle: string
  // The circle that decides about this one: its parent, or the assembly
  // for the assembly itself.
  decider: Deciding
  under: { id: string; name: string }[]
  roles: { id: string; name: string }[]
  mandates: { id: string; label: string }[]
  open: { motion: string; title: string; kind: Kind; deadline: string }[]
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
