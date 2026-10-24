export const kinds = ['work', 'legal', 'development', 'interest'] as const
export type Share = (typeof kinds)[number]

export type Basis = 'salary' | 'hours' | 'equal'

// A year's surplus, as the statutes split it, and the day it was
// allocated, if it was.
export interface Allocation {
  id: string
  year: number
  surplus: number
  basis: Basis
  allocated: string | null
  work: number
  legal: number
  development: number
  interest: number
}

export interface Part {
  id: string
  kind: Share
  percent: number
  amount: number
}

export interface Detail extends Allocation {
  shares: Part[]
}

// The assembly's decision allocating a year's surplus, which the decision
// it cites must have passed.
export interface Allocate {
  allocation: string
  decision: string
}

export interface Allocated extends Allocate {
  allocated: string
  year: number
  surplus: number
}
