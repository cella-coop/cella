export type Status = 'present' | 'excused' | 'absent'

// A member at a meeting: expected, seated in its circle on its day, or a
// guest who marked themselves; and their mark, if any.
export interface Expected {
  id: string
  member: string
  name: string
  seated: boolean
  status: Status | null
}

// Whether a meeting is quorate: its seats, the seated members present,
// and how many must be.
export interface Quorum {
  seats: number
  present: number
  needed: number
}

// The graft's data on a meeting's page: who is expected and who came,
// the quorum, and what the acting member may do: mark themselves, and,
// keeping the minutes, record anyone expected.
export interface OnMeeting {
  roll: Expected[]
  quorum: Quorum
  open: boolean
  actor: string | null
  keeps: boolean
}
