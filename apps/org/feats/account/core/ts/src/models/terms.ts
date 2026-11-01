// The statutes' capital clauses, copied from the rule the members
// adopted (`policy`): the value of a share in cents, the fewest shares an
// associate subscribes, the most monthly instalments they pay them in,
// and the months after an exit before the first repayment and how many
// yearly repayments follow. They govern from the day their rule applies,
// until later terms do.
export interface Terms {
  id: string
  policy: string
  from: string
  share: number
  minimum: number
  instalments: number
  delay: number
  repayments: number
  adopted: string
}

// The capital rule a passed motion adopted, whose values the terms copy.
export interface Adopt {
  policy: string
  motion: string
}

export interface Adopted extends Adopt {
  terms: string
  adopted: string
}
