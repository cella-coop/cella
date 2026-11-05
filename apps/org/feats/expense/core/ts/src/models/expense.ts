// In the board's order: the way forward, then the way out.
export const statuses = ['draft', 'submitted', 'approved', 'reimbursed', 'refused'] as const
export type Status = (typeof statuses)[number]

// What an expense may be charged to: accounts of class 6 of the French
// chart, by code.
export const categories = [
  { code: '6251', label: 'Travel' },
  { code: '6256', label: 'Missions' },
  { code: '6257', label: 'Receptions' },
  { code: '606', label: 'Supplies' },
  { code: '626', label: 'Post, telecoms and software' },
] as const

// An expense, amounts in cents: before VAT, the deductible VAT and the
// total; and where it stands.
export interface Expense {
  id: string
  member: string
  day: string
  label: string
  category: string
  net: number
  vat: number | null
  total: number
  receipt: string | null
  status: Status
  submitted: string | null
  decided: string | null
  decider: string | null
  reimbursed: string | null
}

// A member's claim, as the shell's form sends it. The label is their own
// words and stays out of the log.
export interface Capture {
  member: string
  day: string
  label: string
  category: string
  net: number
  vat: number | null
  receipt: string | null
  // The circle it was spent for, by id; the root's, the assembly's, when
  // none is named.
  circle?: string | null
}

// A claim as its entry keeps it: its id, circle, claimant, day and
// category, and its figures in cents, before VAT, the VAT and the total.
export interface Captured {
  expense: string
  circle: string
  member: string
  day: string
  category: string
  net: number
  vat: number | null
  amount: number
}

export interface Act {
  expense: string
}

// A motion on an expense, or its reimbursement, for its whole amount.
export interface Acted {
  expense: string
  // Its owning circle, which the guard reads a mandate's scope against.
  circle: string
  amount: number
  day: string
}
