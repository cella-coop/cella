// The statutes' capital clauses: the value of a share in cents, the
// fewest shares an associate subscribes, the most monthly instalments
// they pay them in, and the months after an exit before the first
// repayment and how many yearly repayments follow. They govern from a
// year on, once adopted, until later terms are.
export interface Terms {
  id: string
  from: number
  share: number
  minimum: number
  instalments: number
  delay: number
  repayments: number
  adopted: string | null
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
