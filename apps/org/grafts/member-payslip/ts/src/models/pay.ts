import type { State } from '@cella/org-payslip/models'

// A member's pay on their page: their salary in force, in cents, and
// their payslips, the latest first.
export interface Pay {
  salary: number | null
  payslips: { id: string; month: string; gross: number; net: number; state: State }[]
}
