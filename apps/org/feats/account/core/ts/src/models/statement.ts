import type { Terms } from './terms.ts'

// What a portion of the work share divides by.
export type Measure = 'salary' | 'hours' | 'equal'

// A worker's part of a year's work share, in all and by basis, in cents.
export interface Statement {
  id: string
  allocation: string
  year: number
  worker: string
  amount: number
  salary: number
  hours: number
  equal: number
}

// One basis of a worker's part: what it divides by for them (cents paid,
// minutes worked, one equal part), the weight of the basis in the terms,
// the whole portion it divides and their part of it.
export interface Line {
  id: Measure
  basis: Measure
  quantity: number
  weight: number
  portion: number
  amount: number
}

export interface Sheet extends Statement {
  allocated: string | null
  terms: Terms | null
  lines: Line[]
}
