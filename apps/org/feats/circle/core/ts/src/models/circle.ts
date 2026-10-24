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

export interface Detail extends Circle {
  parentName: string | null
  children: { id: string; name: string }[]
  roles: Role[]
  mandates: Mandate[]
}
