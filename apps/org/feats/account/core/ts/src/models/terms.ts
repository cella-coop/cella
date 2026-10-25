// The statutes' terms for each year's work share: the weights, in percent,
// by which it divides among the workers by pay, by time worked and in
// equal parts, which add up to 100, and the percent of an associate's
// part employed in shares of the capital. They govern from a year on,
// once adopted, until later terms are.
export interface Terms {
  id: string
  from: number
  salary: number
  hours: number
  equal: number
  capital: number
  adopted: string | null
  basis: 'salary' | 'hours' | 'equal' | 'mix'
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
