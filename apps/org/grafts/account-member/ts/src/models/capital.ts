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

// The statutes' terms in force, as a member's page reads them back: how
// the work share divides, by pay, time worked or in equal parts, in
// percent, and what part of an associate's share buys capital; a share's
// value, in cents, the fewest an associate subscribes, the most monthly
// instalments, and, for one who leaves, the months before the first
// repayment and the yearly repayments.
export interface Statutes {
  terms: string
  salary: number
  hours: number
  equal: number
  capital: number
  share: number | null
  minimum: number | null
  instalments: number | null
  delay: number | null
  repayments: number | null
}

export interface Rights extends Held {
  statutes: Statutes | null
}
