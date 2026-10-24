// A seat as the graft reads it, with its circle's, member's and role's
// names.
export interface Seat {
  id: string
  circle: string
  circleName: string
  member: string
  memberName: string
  role: string | null
  roleName: string | null
  since: string | null
  until: string | null
}

// A mandate a member holds through a seat they hold; amounts in cents.
export interface Held {
  id: string
  power: string
  text: string
  limit: number | null
  role: string
  circle: string
  circleName: string
}

// A seat to add: a member in a circle, in a role or as a plain member, and
// the decision that seats them, which the write cites.
export interface Add {
  circle: string
  member: string
  role: string | null
  decision: string
}

export interface Added {
  position: number
  since: string
}
