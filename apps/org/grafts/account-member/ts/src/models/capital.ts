// A member's capital: their shares at the share's value, in cents, the
// account holding it, whether it is frozen, and what they may draw.
export interface Capital {
  member: string
  name: string
  status: string
  shares: number
  value: number
  subscribed: number
  account: string | null
  frozen: boolean
  allowance: number | null
}
