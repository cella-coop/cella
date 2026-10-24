// A share granted from a project's budget, in cents.
export interface Granted {
  id: string
  member: string
  name: string
  amount: number
  granted: string
}

// A project's pot: its budget, what was shared from it and what is left,
// with the shares and the members one may go to.
export interface Pot {
  budget: number | null
  shared: number
  remaining: number | null
  shares: Granted[]
  members: { address: string; name: string }[]
  archived: boolean
}

// A member's shares, across projects.
export interface Held {
  id: string
  project: string
  title: string
  amount: number
  granted: string
}
