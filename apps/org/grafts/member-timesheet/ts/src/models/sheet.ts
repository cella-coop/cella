import type { Sheet } from '@cella/org-timesheet/models'

// A member's month, with who approved it by name.
export interface Month extends Sheet {
  // The month, a row's key.
  id: string
  approver_name: string | null
}

// A member's timesheets as the acting member sees them: whether they are
// that member, who submits, or someone else, who may approve.
export interface Months {
  months: Month[]
  own: boolean
  // Whether the member is active, and so submits by their mandate.
  active: boolean
  acting: boolean
}
