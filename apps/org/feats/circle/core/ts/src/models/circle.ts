export type Procedure = 'consent' | 'majority'

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

// A grant of one power to one role; amounts in cents.
export interface Mandate {
  id: string
  role: string
  power: string
  text: string
  limit: number | null
  budget: number | null
  per: 'month' | 'year' | null
  from: string | null
  until: string | null
  revoked: string | null
}

// Each write that changes the tree or its authority cites the decision
// that asks it.
export interface Nest {
  circle: string
  parent: string
  decision: string
}

export interface Nested {
  circle: string
  parent: string
  path: string[]
}

// A grant of one power to one role, capped by a limit per write or a
// budget over a period, in cents, for a term from the verdict date.
export interface Grant {
  role: string
  power: string
  text: string
  limit?: number
  budget?: number
  per?: 'month' | 'year'
  until?: string
  decision: string
}

export interface Granted {
  mandate: number
  role: string
  power: string
  from: string
}

export interface Revoke {
  mandate: number
  decision: string
}

export interface Revoked {
  mandate: number
  revoked: string
}

export interface Detail extends Circle {
  parentName: string | null
  children: { id: string; name: string }[]
  roles: Role[]
  mandates: Mandate[]
}
