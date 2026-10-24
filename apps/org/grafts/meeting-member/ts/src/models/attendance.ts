export const statuses = ['present', 'excused', 'absent'] as const
export type Status = (typeof statuses)[number]

// A member's mark at a meeting, by whom and when.
export interface Mark {
  member: string
  name: string
  status: Status
  marked: string | null
  by: string | null
}

// A member marks their own attendance; the minutes' keeper records
// anyone's.
export interface Attend {
  meeting: string
  member: string
  status: Status
}

// A meeting a member was marked at, as their page lists it.
export interface Attended {
  meeting: string
  title: string
  at: string
  status: Status
}
