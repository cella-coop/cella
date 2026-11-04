// The id of a procedure the motion feat holds: consent, majority, two
// thirds or one of the co-op's own.
export type Procedure = string

// A circle as the feat reads it: none is within another, and one only
// is the assembly.
export interface Circle {
  id: string
  name: string
  assembly: boolean
  purpose: string
  procedure: Procedure
}

// `circle` is one circle, or `*` for a role every working circle has.
export interface Role {
  id: string
  circle: string
  name: string
  duty: string
}

// A grant of one power to one grantee, here a role of the circle: the
// values of the mandate policy that grants it, and its sentence as it
// reads; amounts in cents.
export interface Mandate {
  id: string
  grantee: string
  power: string
  policy: string
  sentence: string
  limit: number | null
  budget: number | null
  per: 'month' | 'year' | null
  // What it covers: a circle's id, `own`, the circle its holder holds
  // the role in, or null, the whole co-op.
  scope: string | null
  issuer: string
  from: string
  until: string | null
  revoked: string | null
}

// What adopting or ending a policy did to the mandates: the mandate its
// policy grants or ended, none for a policy of another kind, and every
// mandate the write revoked, down the provenance tree from the one it
// ended or replaced, that one first.
export interface Granted {
  mandate: number | null
  revoked: number[]
}

export interface Detail extends Circle {
  // The circles that issued what this circle and its roles hold, and
  // those it issued to: how the mandates link it to the others, since
  // circles never nest.
  issuers: { id: string; name: string }[]
  issued: { id: string; name: string }[]
  roles: Role[]
  mandates: Mandate[]
}

// A circle to create, by the motion that creates it, which the write
// cites.
export interface Create {
  id: string
  name: string
  purpose: string
  motion: string
}

// The circle created and the default bundle it holds from its first day:
// the mandates on the roles every circle has, in force that day, by id.
export interface Created {
  circle: string
  bundle: number[]
}
