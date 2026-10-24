// How a circle meets: the share of its seats a meeting needs present, in
// percent, and whether its minutes are adopted by decision.
export interface Setting {
  quorum: number
  adopts: boolean
}

// A meeting's circle, as the meeting's page shows it.
export interface Held extends Setting {
  circle: string
  name: string
}

// A meeting of a circle, as the circle's page lists it.
export interface Met {
  id: string
  title: string
  at: string
  status: string
}

// The graft's data on a circle's page: its meetings, the latest first,
// and the next one scheduled.
export interface OnCircle extends Setting {
  meetings: Met[]
  next: Met | null
}
