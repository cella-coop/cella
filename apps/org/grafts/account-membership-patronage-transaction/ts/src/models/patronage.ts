// A line of a worker's capital account, as their statement lists it, with
// the balance after it, in cents.
export interface Movement {
  id: string
  entry: string
  date: string
  label: string
  side: 'debit' | 'credit'
  amount: number
  balance: number
}

// What a worker's part of a year's work share became once the distribution
// posted: the shares its credit bought, blocked until a day the law sets, on which
// capital account and by which entry; the rest owed in cash, which no
// write pays out yet; and the account's movements.
export interface Employed {
  part: number
  shares: number
  capital: number
  cash: number
  until: string | null
  account: string | null
  entry: string | null
  movements: Movement[]
}

// A figure of a year's return to the federation: what it is, its value,
// the law it answers to, and whether that was checked against the primary
// source. Cents for money, a count, a percent or a day.
export interface Figure {
  id: string
  label: string
  value: number | string | null
  unit: 'cents' | 'count' | 'percent' | 'date'
  source: string
  verified: boolean
}

// A member's statement of a year's work share, as their page lists it for
// them: their part, and what it employs in shares and pays, as credited
// once distributed.
export interface Owed {
  id: string
  distribution: string
  year: number
  part: number
  shares: number
  capital: number
  cash: number
  distributed: boolean
}

// An associate's part of a distribution employed in shares, citing the
// motion that approved the split.
export interface Employ {
  distribution: string
  member: string
  motion: string
}

// What the credit made: the shares and their value in cents, the capital
// account they credit, the day they are blocked until, the entry that
// posted them and what the member holds after.
export interface Credited extends Employ {
  account: string
  shares: number
  amount: number
  until: string
  entry: string
  holds: number
}
