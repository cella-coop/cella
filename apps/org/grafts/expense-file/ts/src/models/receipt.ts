import type { Capture } from '@cella/org-expense/models'
import type { Store } from '@cella/org-file/models'

// A member's claim with its receipt, if they have it to hand.
export interface Claim extends Capture {
  file: Store | null
}

// A receipt attached to an expense already claimed.
export interface Attach {
  expense: string
  file: Store
}

export interface Attached {
  expense: string
  file: string
}

// The receipts an expense holds, each a file the member may open.
export interface Receipt {
  id: string
  name: string
  type: string
  size: number
  uploaded: string
}
