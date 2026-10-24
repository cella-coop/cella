// Who claimed an expense and who decided it, by name.
export interface Claimed {
  name: string
  decider_name: string | null
}

// An expense on its member's page.
export interface Claim {
  id: string
  label: string
  day: string
  total: number
  status: string
}
