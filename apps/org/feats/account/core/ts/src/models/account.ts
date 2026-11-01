export type Kind = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

// An account of the chart, by its code. Its balance is never stored: the
// account-transaction graft sums it from the journal.
export interface Account {
  id: string
  code: string
  label: string
  kind: Kind
  parent: string | null
  holder: string | null
  frozen: boolean
  cash: boolean
}

// A month of the books, open until closed.
export interface Period {
  id: string
  month: string
  closed: string | null
}

// An account to open in the chart, by its code and label; its kind is its
// code's class's.
export interface Open {
  code: string
  label: string
}

// A capital account to open for its holder, by address, under `parent`,
// with the label the write gives it.
export interface Hold {
  holder: string
  parent: string
  label: string
}

// The capital accounts of a holder to freeze, citing the motion that
// ended their membership.
export interface Freeze {
  holder: string
  motion: string
}

// The accounts a freeze froze.
export interface Frozen {
  holder: string
  accounts: string[]
}
