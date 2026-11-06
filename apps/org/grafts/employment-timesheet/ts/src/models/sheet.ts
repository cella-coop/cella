import type { Sheet } from '@cella/org-timesheet/models'

// A worker's month, with who approved it by name.
export interface Month extends Sheet {
  // The month and its circle, `YYYY-MM/<circle>`, a row's key and what
  // the submit and approve forms send.
  id: string
  approver_name: string | null
}

// A worker's timesheets as the acting member sees them: whether they are
// that worker, who submits, or someone else, who may approve.
export interface Months {
  months: Month[]
  own: boolean
  acting: boolean
}
