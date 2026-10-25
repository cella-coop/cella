import type { Basis } from './terms.ts'

export const kinds = ['work', 'legal', 'development', 'interest'] as const
export type Kind = (typeof kinds)[number]

// A year's distribution of its surplus, as the statutes split it: drafted,
// approved by the assembly, then distributed.
export interface Distribution {
  id: string
  year: number
  surplus: number
  basis: Basis
  approved: string | null
  distributed: string | null
  work: number
  legal: number
  development: number
  interest: number
}

export interface Share {
  id: string
  kind: Kind
  percent: number
  amount: number
}

export interface Detail extends Distribution {
  shares: Share[]
}

// Where a distribution stands in its lifecycle.
export const stage = (d: Pick<Distribution, 'approved' | 'distributed'>) =>
  d.distributed ? 'distributed' : d.approved ? 'approved' : 'draft'

// The assembly's decision approving a year's split, which the decision it
// cites must have passed.
export interface Approve {
  distribution: string
  decision: string
}

export interface Approved extends Approve {
  approved: string
}

// Distributing an approved split: posting it, and crediting the shares it
// buys.
export interface Distribute {
  distribution: string
}

export interface Distributed extends Distribute {
  distributed: string
  year: number
  surplus: number
}
