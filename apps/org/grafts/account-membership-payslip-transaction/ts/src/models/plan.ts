// An associate spreads what they owe on their subscription over monthly
// instalments withheld from their pay.
export interface Spread {
  member: string
  instalments: number
}

export interface Spreading extends Spread {
  each: number
}

// What one month's pay withheld, as a member's page lists it.
export interface Instalment {
  id: string
  month: string
  amount: number
  entry: string
}

// A member's plan as their page shows it: how many instalments, of how
// much, since when, what was withheld so far and what is still owed; the
// most the statutes still allow, less what was withheld; and whether the
// one looking may spread it.
export interface Plan {
  instalments: number | null
  each: number | null
  since: string | null
  unpaid: number
  allowed: number | null
  own: boolean
  withheld: Instalment[]
}

// What a payslip's pay withheld for its member's subscription, if any.
export interface Withheld {
  amount: number
  entry: string
  net: number | null
}
