// The statutes' terms: for each year's work share, the weights, in percent,
// by which it divides among the workers by pay, by time worked and in
// equal parts, which add up to 100, and the percent of an associate's
// part employed in shares of the capital; and, where they state them, the
// capital's clauses: the value of a share in cents, the fewest shares an
// associate subscribes, the most monthly instalments they pay them in, and
// the months after an exit before the first repayment and how many yearly
// repayments follow. They govern from a year on, once adopted, until
// later terms are.
export interface Terms {
  id: string
  from: number
  salary: number
  hours: number
  equal: number
  capital: number
  share: number | null
  minimum: number | null
  instalments: number | null
  delay: number | null
  repayments: number | null
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
