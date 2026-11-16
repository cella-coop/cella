// Who claimed an expense and who decided it, by name.
export interface Claimed {
  name: string
  decider_name: string | null
}
