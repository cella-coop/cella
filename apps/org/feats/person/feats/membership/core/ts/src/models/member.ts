import type { Device } from '@cella/org-person/models'

export type Status = 'invited' | 'active' | 'suspended' | 'exited'

// A person's membership as a chip: a member, invited, suspended or a
// former member.
export const chips: Record<Status, string> = { active: 'member', invited: 'invited', suspended: 'suspended', exited: 'former member' }

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

// Admission cites the motion that admits; the membership-motion graft's
// guard resolves it, so this feat holds it as an id.
export interface Admit {
  member: string
  shares: number
  motion: string
}

export interface Admitted {
  member: string
  since: string
}

// Someone invited to join, by the address they will hold, and the link
// their invitation is taken up by, if it comes with one: the SHA-256 in
// hex of a secret the inviter's browser drew, which only the link holds.
// Someone the co-op knows already, as a worker, keeps their name.
export interface Invite {
  address: string
  name: string
  link?: string
}

export interface Invited {
  member: string
  invited: string
  link?: string
}

// A new link for someone invited, as its digest.
export interface Link {
  member: string
  link: string
}

// An invitation taken up: the link's secret, in hex, and the first device
// the invitee's browser made, its public key in hex and what they call
// it; the device signs this write itself.
export interface Accept {
  member: string
  secret: string
  key: string
  label: string
}

export interface Accepted {
  member: string
  link: string
  key: string
  accepted: string
}

// A suspension or an exclusion, citing the motion that asks it.
export interface End {
  member: string
  motion: string
}

// A withdrawal, the member's own: it cites no motion.
export interface Withdraw {
  member: string
}

export interface Ended {
  member: string
  on: string
}

// An erasure of one's own personal data: all of it, once one has left.
// It cites no motion.
export interface Erase {
  member: string
}

// The first device an invitation enrolled when it was taken up.
export interface First {
  key: string
  label: string
  accepted: string
}

// A person's membership on their page, if they hold one; the first device
// their invitation enrolled, once taken up, and the links it may still be
// taken up by; and every device enrolled under their address, for the
// step joining asks.
export interface Membership {
  member: Member | null
  first: First | null
  links: number
  devices: Device[]
  // Whether the page is the reader's own, where they may withdraw, and
  // once they have left erase their data.
  own: boolean
}

// An application, an employee asking to join by their own right: the
// applicant, who is the actor.
export interface Apply {
  member: string
}

export interface Applied {
  member: string
  applied: string
}
