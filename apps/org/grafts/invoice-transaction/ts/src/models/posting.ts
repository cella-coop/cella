// A line an invoice's event posted to the journal, in cents.
export interface Posted {
  id: string
  entry: string
  event: 'issue' | 'payment' | 'void'
  date: string
  account: string
  side: 'debit' | 'credit'
  cents: number
}
