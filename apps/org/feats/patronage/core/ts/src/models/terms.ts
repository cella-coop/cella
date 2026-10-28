export type Basis = 'salary' | 'hours' | 'equal' | 'mix'

// How each basis divides the work share, as the shell says it.
export const divides: Record<Basis, string> = { salary: 'by pay', hours: 'by time worked', equal: 'in equal parts', mix: 'by a mix' }

// The statutes' terms for each year's work share: the weights, in
// percent, by which it divides among the workers by pay, by time worked
// and in equal parts, which add up to 100, and the percent of an
// associate's part employed in shares of the capital, and the highest
// rate of interest they pay on the capital (loi n° 47-1775, art. 14).
// They govern from a year on, once adopted, until later terms are.
export interface Terms {
  id: string
  from: number
  salary: number
  hours: number
  equal: number
  capital: number
  interest: number
  adopted: string | null
  basis: Basis
}

// The members' decision adopting drafted terms, which the decision it
// cites must have passed.
export interface Adopt {
  terms: string
  decision: string
}

export interface Adopted extends Adopt {
  adopted: string
}

// Terms drafted for the members to adopt, from a year on: the weights, the
// percent employed in shares and the highest rate of interest, each in
// hundredths of a percent, as a signed request holds integers only.
export interface DraftTerms {
  from: number
  salary: number
  hours: number
  equal: number
  capital: number
  interest: number
}

export interface DraftedTerms extends DraftTerms {
  terms: string
}
