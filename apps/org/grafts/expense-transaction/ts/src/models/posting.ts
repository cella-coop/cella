// A line an expense's event posted to the journal, in cents.
export interface Posted {
  id: string
  entry: string
  event: 'charge' | 'payment'
  date: string
  account: string
  side: 'debit' | 'credit'
  cents: number
}
