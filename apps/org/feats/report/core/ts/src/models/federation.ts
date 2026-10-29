// A distributed year's figures, as the federation asks them, in cents.
export interface Federation {
  distribution: string
  year: number
  distributed: string
  surplus: number
  // Each share of the split, its percent and amount.
  shares: { kind: string; percent: string; amount: number }[]
  // What its entry posted, account by account.
  posted: { code: string; label: string; debit: number; credit: number }[]
  // The capital it credited.
  credited: { members: number; shares: number; amount: number; until: string | null }
  // Its work share by basis.
  parts: { basis: string; workers: number; quantity: number; amount: number }[]
  workers: number
  associates: number
  reserve: number
  // The distributed years, to move between.
  years: number[]
}
