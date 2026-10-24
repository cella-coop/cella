export const states = ['prepared', 'approved', 'paid'] as const
export type State = (typeof states)[number]

// A member's payslip for a month, amounts in cents, with where its run
// stands. Hours are those of the member's approved month, where it was
// timed.
export interface Payslip {
  id: string
  month: string
  member: string
  hours: number | null
  gross: number
  employee: number
  employer: number
  net: number
  // What the co-op pays for it: gross pay and the employer's charges.
  cost: number
  state: State
  generated: string
  approved: string | null
  approver: string | null
  paid: string | null
}

// A month's run, as its writes name it.
export interface Run {
  month: string
}

export interface Ran extends Run {
  day: string
  payslips: number
  gross: number
}
