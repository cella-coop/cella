// An entry a pay run posted.
export interface Posted {
  id: string
  entry: string
  event: 'accrual' | 'payment' | 'carried'
  date: string
}
