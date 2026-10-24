export type Standing = 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'voided'

// An invoice as the feat lists it, amounts in cents, its standing read
// from its payments by `invoice.standing`.
export interface Listed {
  id: string
  issued: string
  due: string
  bill_to: string
  label: string
  total: number
  paid: number
  owed: number
  credit: number
  state: Standing
  overdue: boolean
  sent: string | null
  voided: string | null
}

export interface Lined {
  id: string
  n: number
  description: string
  quantity: string
  unit_price: number
  amount: number
  vat_rate: string
}

export interface Received {
  id: string
  receipt: number
  at: string
  amount: number
  method: string
  reference: string
}

export interface Detail extends Listed {
  series: string
  number: number
  net: number
  vat: number | null
  reason: string | null
  lines: Lined[]
  payments: Received[]
}

// What issuing a new invoice offers: the series and their next numbers,
// and the names already billed.
export interface Issuing {
  series: { name: string; next: number }[]
  billed: string[]
}

export interface Line {
  description: string
  // A decimal, as text, so that 2.5 days stays exact.
  quantity: string
  // Cents.
  unit_price: number
  // A percentage: 20 for France's standard rate.
  vat_rate: number
}

export interface Issue {
  series: string
  bill_to: string
  label: string
  // YYYY-MM-DD; thirty days after issue when absent.
  due?: string
  lines: Line[]
}

// The invoice as issued, amounts in cents.
export interface Issued {
  invoice: string
  issued: string
  net: number
  vat: number | null
  total: number
}

export interface Send {
  invoice: string
}

export interface Sent {
  invoice: string
  // Null when the invoice was voided: a voided invoice is not sent.
  sent: string | null
}

export interface Payment {
  invoice: string
  // YYYY-MM-DD, the day the bank received it.
  at: string
  // Cents.
  amount: number
  method?: string
  // The bank's reference: the same one recorded twice is one payment.
  reference: string
}

export interface Paid {
  invoice: string
  payment: number
  at: string
  // True when the reference was already recorded: nothing new was paid.
  merged: boolean
}

export interface Void {
  invoice: string
  reason: string
}

export interface Voided {
  invoice: string
  voided: string
}
