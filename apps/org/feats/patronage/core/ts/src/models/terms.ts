export type Basis = 'salary' | 'hours' | 'equal' | 'mix'

// How each basis divides the work share, as the shell says it.
export const divides: Record<Basis, string> = { salary: 'by pay', hours: 'by time worked', equal: 'in equal parts', mix: 'by a mix' }

// The statutes' terms for each year's work share: the weights, in
// percent, by which it divides among the workers by pay, by time worked
// and in equal parts, which add up to 100, and the percent of an
// associate's part employed in shares of the capital, and the highest
// rate of interest they pay on the capital (loi n° 47-1775, art. 14).
// They are copied from the rule the members adopted (`policy`), and
// govern from the fiscal year it applies in, until later terms do.
export interface Terms {
  id: string
  policy: string
  from: number
  salary: number
  hours: number
  equal: number
  capital: number
  interest: number
  adopted: string
  basis: Basis
}

// The work share rule a passed motion adopted, whose values the terms
// copy.
export interface Adopt {
  policy: string
  motion: string
}

export interface Adopted extends Adopt {
  terms: string
  adopted: string
}
