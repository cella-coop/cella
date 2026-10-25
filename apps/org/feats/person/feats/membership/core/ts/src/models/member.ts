import type { Device } from '@cella/org-person/models'

export type Status = 'invited' | 'active' | 'suspended' | 'exited'

// A membership as the feat reads it, with the name of the person who holds
// it; `id` is their address.
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

// Admission cites the decision that admits; the decision-membership graft's
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

// Someone invited to join, by the address they will hold, with their
// first device: the public key in hex their device made, whose private
// key never leaves it, and the label they gave the device. Someone the
// co-op knows already, as a worker, keeps their name.
export interface Invite {
  address: string
  name: string
  key: string
  label: string
}

export interface Invited {
  member: string
  invited: string
  key: string
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

// An erasure of a member's personal data: all of it, by the decision
// that asks it, once they have left.
export interface Erase {
  member: string
  decision: string
}

// A first device waiting on its member's admission, or enrolled by it.
export interface First {
  key: string
  label: string
  enrolled: string | null
}

// A person's membership on their page, if they hold one, and the first
// device their invitation carried; and every device enrolled under their
// address, for the step joining asks.
export interface Membership {
  member: Member | null
  first: First | null
  devices: Device[]
}
