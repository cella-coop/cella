// A member a decision asks to admit, with their name and the shares.
export interface Admission {
  id: string
  decision: string
  member: string
  name: string | null
  shares: number
}
