// An account's debits, credits and signed balance, debit positive, in cents.
export interface Balance {
  debit: number
  credit: number
  balance: number
}

// A line posted to an account, with its entry's date and label.
export interface Movement {
  id: string
  entry: string
  date: string
  label: string
  side: 'debit' | 'credit'
  cents: number
}

export interface Ledger extends Balance {
  movements: Movement[]
}
