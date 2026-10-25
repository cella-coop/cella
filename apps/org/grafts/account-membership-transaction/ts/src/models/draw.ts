// A member's draw on their own account, in cents.
export interface Draw {
  member: string
  cents: number
}

export interface Drawn {
  member: string
  amount: number
  entry: string
}

// A draw as a member's page lists it.
export interface Drawing {
  id: string
  entry: string
  date: string
  amount: number
}

// A member's account as their page shows it: what they drew, of what
// limit, whether it is frozen, its balance in the books, and whether the
// one looking may draw on it.
export interface Account {
  account: string | null
  frozen: boolean
  allowance: number | null
  drawn: number
  balance: number
  subscribed: string | null
  own: boolean
  draws: Drawing[]
}
