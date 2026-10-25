// A span the financial statements are drawn for: a month, a quarter or a
// year of the books, its first and last day, the span of the same length
// before it, which the statements compare it with, and whether every
// period of it is closed; `earlier`, whether the span before is one of the
// books too.
export interface Report {
  id: string
  kind: 'month' | 'quarter' | 'year'
  since: string
  until: string
  before: string
  closed: boolean
  earlier: boolean
}
