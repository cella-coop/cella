// A share granted from a project's budget, in cents.
export interface Granted {
  id: string
  member: string
  name: string
  amount: number
  granted: string
}

// Who runs the project, Linear's lead or one of its members: an active
// member, by address and name.
export interface Crewed {
  address: string
  name: string
}

// A project's pot: its budget, what was shared from it and what is left,
// with the shares and the members one may go to; and its crew, the lead
// and the rest, independent of who edits the project, with the active
// members one may set either from.
export interface Pot {
  budget: number | null
  shared: number
  remaining: number | null
  shares: Granted[]
  members: { address: string; name: string }[]
  archived: boolean
  lead: Crewed | null
  crew: Crewed[]
}

// A member's shares, across projects.
export interface Held {
  id: string
  project: string
  title: string
  amount: number
  granted: string
}
