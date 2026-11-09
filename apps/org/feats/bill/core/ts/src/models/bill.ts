import type { Line, Taxed } from '@cella/org-vat'

// In the lifecycle's order.
export const statuses = ['recorded', 'approved', 'paid'] as const
export type Status = (typeof statuses)[number]

// What a bill may be charged to: accounts of class 6 of the French chart,
// by code.
export const categories = [
  { code: '606', label: 'Supplies' },
  { code: '613', label: 'Rent and hire' },
  { code: '626', label: 'Post, telecoms and software' },
  { code: '6251', label: 'Travel' },
  { code: '6257', label: 'Receptions' },
] as const

// A bill as the collection lists it, amounts in cents; `standing` is its
// status, or overdue where it is past due and not paid.
export interface Listed {
  id: string
  supplier: string
  reference: string
  issued: string
  due: string
  label: string
  category: string
  net: number
  vat: number | null
  total: number
  status: Status
  standing: Status | 'overdue'
  recorded: string
  recorder: string
  approved: string | null
  approver: string | null
  paid: string | null
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

export interface Detail extends Listed {
  lines: Lined[]
  taxed: Taxed[]
}

// What recording a bill offers: the suppliers already billing the co-op,
// and the day.
export interface Recording {
  suppliers: string[]
  today: string
}

// A supplier's bill as it comes, to record.
export interface Incoming {
  supplier: string
  // The supplier's own number for the bill.
  reference: string
  // YYYY-MM-DD, the date the bill bears.
  issued: string
  // YYYY-MM-DD; thirty days after `issued` when absent.
  due?: string
  label: string
  category: string
  lines: Line[]
  // The circle whose purchase it is, by id; the root's, the assembly's,
  // when none is named.
  circle?: string | null
}

// The bill as recorded, amounts in cents.
export interface Recorded {
  bill: string
  circle: string
  net: number
  vat: number | null
  total: number
  // True when the supplier's reference was already recorded: nothing new
  // was recorded.
  merged: boolean
}

export interface Act {
  bill: string
}

// An approval or a payment, for the bill's whole total, on its day.
export interface Acted {
  bill: string
  circle: string
  amount: number
  day: string
}
