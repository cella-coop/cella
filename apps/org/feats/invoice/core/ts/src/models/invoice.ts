import type { Line, Taxed } from '@cella/org-vat'

// A line and the VAT by rate, as the VAT core library counts them for
// invoices and bills alike.
export type { Line, Taxed }

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
  // The address billed, its lines separated by newlines, as issued; null
  // on an invoice issued before it was kept.
  bill_address: string | null
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

export interface Issue {
  series: string
  bill_to: string
  // The address billed, its lines separated by newlines: a mandatory
  // mention, which an import from a file without it leaves out.
  bill_address?: string
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

// The seller as an invoice names it (code de commerce, art. R123-237):
// the scope's settings, `cella.scope_legal_name` and beside it, kept with
// the invoice when it issues (`invoice.seller`); a setting not made is
// null and not printed.
export interface Seller {
  name: string | null
  form: string | null
  capital: string | null
  siren: string | null
  rcs: string | null
  vat: string | null
  seat: string | null
}

// What an invoice's PDF prints: the invoice as issued, its VAT by rate
// and its seller. Payments are not printed: the invoice is what was
// issued, and a payment is a fact about it.
export interface Printed {
  invoice: Detail
  taxed: Taxed[]
  seller: Seller
}
