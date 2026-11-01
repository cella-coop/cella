import type { Summary } from '@cella/org-motion/models'
import type { Add, Added } from '@cella/org-meeting/models'

// An agenda item that tables a motion, and where the motion stands:
// open until its deadline, or closed.
export interface Tabled {
  id: string
  n: number
  title: string
  motion: string
  name: string
  circle: string
  deadline: string
  closed: string | null
}


// The graft's data on a meeting's page: the items that table motions,
// the motions it may table or its minutes embed, and whether its
// agenda is still open.
export interface OnMeeting {
  tabled: Tabled[]
  motions: Summary[]
  open: boolean
}

// A meeting a motion is tabled at, as the motion's page lists it.
export interface Sitting {
  meeting: string
  title: string
  at: string
  status: string
}

// An item added to the agenda with the motion it tables, and what
// adding it did.
export interface Table extends Add {
  motion: string
}

export interface Put extends Added {
  motion: string
}
