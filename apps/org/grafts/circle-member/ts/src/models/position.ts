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
