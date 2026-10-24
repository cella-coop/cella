import type { Summary } from '@cella/org-decision/models'
import type { Add, Added } from '@cella/org-meeting/models'

// An agenda item that tables a decision, and where the decision stands:
// open until its deadline, or closed.
export interface Tabled {
  id: string
  n: number
  title: string
  decision: string
  name: string
  circle: string
  deadline: string
  closed: string | null
}


// The graft's data on a meeting's page: the items that table decisions,
// the decisions it may table or its minutes embed, and whether its
// agenda is still open.
export interface OnMeeting {
  tabled: Tabled[]
  decisions: Summary[]
  open: boolean
}

// A meeting a decision is tabled at, as the decision's page lists it.
export interface Sitting {
  meeting: string
  title: string
  at: string
  status: string
}

// An item added to the agenda with the decision it tables, and what
// adding it did.
export interface Table extends Add {
  decision: string
}

export interface Put extends Added {
  decision: string
}
