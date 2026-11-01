// The id of a procedure the motion feat holds: consent, majority, two
// thirds or one of the co-op's own.
export type Procedure = string

// A circle as the feat reads it.
export interface Circle {
  id: string
  name: string
  parent: string | null
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

// A grant of one power to one role: the values of the mandate policy that
// grants it, and its sentence as it reads; amounts in cents.
export interface Mandate {
  id: string
  role: string
  power: string
  policy: string
  sentence: string
  limit: number | null
  budget: number | null
  per: 'month' | 'year' | null
  from: string
  until: string | null
  revoked: string | null
}

// Each write that changes the tree cites the motion that asks it.
export interface Nest {
  circle: string
  parent: string
  motion: string
}

export interface Nested {
  circle: string
  parent: string
  path: string[]
}

export interface Detail extends Circle {
  parentName: string | null
  children: { id: string; name: string }[]
  roles: Role[]
  mandates: Mandate[]
}
