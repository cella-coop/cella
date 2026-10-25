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

// The statutes' capital clauses in force, as a member's page reads them
// back: a share's value, in cents, the fewest an associate subscribes,
// the most monthly instalments, and, for one who leaves, the months
// before the first repayment and the yearly repayments.
export interface Statutes {
  terms: string
  share: number
  minimum: number
  instalments: number
  delay: number
  repayments: number
}

export interface Rights extends Capital {
  statutes: Statutes | null
}
