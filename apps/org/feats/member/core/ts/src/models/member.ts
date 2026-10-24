export type Status = 'invited' | 'active' | 'suspended' | 'exited'

// A member as the feat reads them; `id` is their address.
export interface Member {
  id: string
  address: string
  name: string
  status: Status
  since: string | null
  shares: number
  // The days the membership moved, where the records hold them.
  invited: string | null
  suspended: string | null
  exited: string | null
}

// Admission cites the decision that admits; the decision-member graft's
// rule resolves it, so this feat holds it as an id.
export interface Admit {
  member: string
  shares: number
  decision: string
}

export interface Admitted {
  member: string
  since: string
}

// Someone invited to join, by the address they will hold.
export interface Invite {
  address: string
  name: string
}

export interface Invited {
  member: string
  invited: string
}

// A suspension or an exit, citing the decision that asks it.
export interface End {
  member: string
  decision: string
}

export interface Ended {
  member: string
  on: string
}

// A member's own fields; only those given change.
export interface Profile {
  member: string
  name?: string
}

// The fields a profile write changed, by name: their values are personal
// data and stay out of the log.
export interface Profiled {
  member: string
  fields: string[]
}
