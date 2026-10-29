// A span of the books the statements are drawn over, against the span of
// the same length before it.
export interface Span {
  id: string
  kind: 'month' | 'quarter' | 'year'
  since: string
  until: string
  before: string
  before_since: string
  before_until: string
  closed: boolean
}

// An account a statement's line gathers, with its figure in each column,
// in cents, and its ledger's address.
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

// A sheet over a span against the span before it, and the spans a page
// moves between.
export interface Statement {
  sheet: 'income' | 'balance'
  span: Span
  columns: [string, string]
  rubrics: Rubric[]
  spans: Pick<Span, 'id' | 'kind'>[]
}
