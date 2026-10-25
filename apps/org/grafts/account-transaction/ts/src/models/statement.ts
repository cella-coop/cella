// An account a statement's line gathers, with its figure in each column, in
// cents, and its ledger's address.
export interface Gathered {
  code: string
  label: string
  href: string
  amounts: number[]
}

// A rubric of a statement with its figure in each column, in cents: the
// span's, then the span's before it; a heading has none.
export interface Rubric {
  id: string
  kind: 'heading' | 'line' | 'total'
  label: string
  amounts: (number | null)[]
  accounts?: Gathered[]
}

// A span's financial statements against the span before it: the income
// statement over each, and the balance sheet at the end of each.
export interface Statements {
  columns: [string, string]
  income: Rubric[]
  balance: Rubric[]
}

// A span's figures in the list: its result and its total assets.
export interface Figures {
  result: number
  assets: number
}
