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
