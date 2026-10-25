// A member's capital: their shares at the share's value, in cents, the
// account holding it, whether it is frozen, and what they may draw.
export interface Capital {
  member: string
  name: string
  status: string
  shares: number
  value: number
  subscribed: number
  account: string | null
  frozen: boolean
  allowance: number | null
}

// A member's statement of a year's work share, as their page lists it for
// them: their part, and the split the terms make of it today.
export interface Owed {
  id: string
  allocation: string
  year: number
  part: number
  shares: number
  capital: number
  cash: number
}

export interface Held extends Capital {
  statements: Owed[]
}
