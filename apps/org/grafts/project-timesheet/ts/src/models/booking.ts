// A project's time: its hours, billable hours and what they spent of its
// budget, in cents, by member and entry by entry.
export interface Time {
  hours: number
  billable: number
  spent: number
  hourly: number | null
  members: { id: string; member: string; hours: number; billable: number }[]
  entries: { id: string; member: string; day: string; hours: number; billable: boolean }[]
  today: string
  archived: boolean
  // The circles the acting member may log time on it for, the project's
  // first where they sit in it.
  circles: { id: string; name: string }[]
}

// What each project's time spent, by project.
export interface Burn {
  hours: number
  used: number
}
